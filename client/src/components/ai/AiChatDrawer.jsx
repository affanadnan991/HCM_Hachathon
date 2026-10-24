import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bot, X, Send, Sparkles, Shield, Wrench, CheckCircle, 
  AlertCircle, Calendar, Clock, ArrowRight, UserCheck, RefreshCw, MessageSquare
} from 'lucide-react';

export default function AiChatDrawer({ isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello ${user?.name || 'there'}! I am your HCM Lite AI Assistant. I can help you query attendance metrics, check headcount, look up company policies, check your leave balances, or draft smart leave applications in English or Roman Urdu.`,
      toolCalled: null,
      isAiGenerated: true
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState({ remaining: 20 });
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaveSuccess, setLeaveSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'logs'
  const [aiLogs, setAiLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Load AI Audit Logs if Admin/HR switches to logs tab
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const token = localStorage.getItem('hcm_token');
      const res = await fetch('/api/ai/logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAiLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load AI logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSend = async (customPrompt) => {
    const promptToSend = (customPrompt || inputPrompt).trim();
    if (!promptToSend || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: promptToSend
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputPrompt('');
    setLoading(true);

    try {
      const token = localStorage.getItem('hcm_token');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: promptToSend })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'assistant',
            text: data.error || 'Failed to process AI query.',
            isError: true,
            isAiGenerated: true
          }
        ]);
        return;
      }

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: data.reply,
          toolCalled: data.toolCalled,
          smartLeave: data.smartLeave,
          isAiGenerated: data.isAiGenerated
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: 'Network error connecting to AI Assistant engine.',
          isError: true,
          isAiGenerated: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Smart Leave Confirm and Submit
  const handleConfirmSmartLeave = async (smartLeave) => {
    setConfirmingLeave(true);
    setLeaveSuccess(null);
    try {
      const token = localStorage.getItem('hcm_token');
      
      // Fetch leave types to get ID matching leave_type
      const typeRes = await fetch('/api/leave/types', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const types = await typeRes.json();
      const matched = types.find(t => t.name.toLowerCase() === smartLeave.leave_type.toLowerCase()) || types[0];

      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          leave_type_id: matched.id,
          start_date: smartLeave.start_date,
          end_date: smartLeave.end_date,
          reason: smartLeave.reason
        })
      });

      const result = await res.json();

      if (res.ok) {
        setLeaveSuccess(`✅ Leave application submitted successfully! Reference ID #${result.leave.id}. Awaiting HR approval.`);
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 2).toString(),
            sender: 'assistant',
            text: `🎉 Success! Your ${smartLeave.leave_type} leave from ${smartLeave.start_date} to ${smartLeave.end_date} has been officially recorded in the database. HR has been notified for approval.`,
            isAiGenerated: true
          }
        ]);
      } else {
        alert(result.error || 'Failed to submit leave.');
      }
    } catch (err) {
      alert('Error submitting leave: ' + err.message);
    } finally {
      setConfirmingLeave(false);
    }
  };

  if (!isOpen) return null;

  // Curated quick prompt chips for hackathon live demo
  const quickChips = user?.role === 'EMPLOYEE' ? [
    'What is my remaining sick leave balance?',
    'Need 2 days off next monday and tuesday for sister wedding',
    'kal meri tabiyat theek nahi he mujhe sick leave chahiye',
    'What is company grace period and half day policy?',
    'What is John Doe salary?' // Demo polite refusal guardrail!
  ] : [
    'How many active employees are in Engineering?',
    'Who has arrived late most often this month?',
    'What was our attendance rate yesterday?',
    'What is company grace period and half day policy?',
    'How many active employees do we have?'
  ];

  return (
    <div className="modal-backdrop" style={{ alignItems: 'stretch', justifyContent: 'flex-end', padding: 0 }}>
      <div 
        className="glass-card" 
        style={{
          width: '520px',
          maxWidth: '100vw',
          height: '100vh',
          borderRadius: 0,
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.4)',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          animation: 'slideIn 0.3s ease-out'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(99, 102, 241, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
            }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '1.0625rem' }}>HCM Assistant</span>
                <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                  <Sparkles size={10} style={{ marginRight: '3px' }} /> 7 Tools Active
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                <span>Role: {user?.role}</span>
                <span>•</span>
                <span>20 req/hr rate limit</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {(user?.role === 'ADMIN' || user?.role === 'HR') && (
              <button 
                className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  if (activeTab === 'chat') {
                    setActiveTab('logs');
                    fetchLogs();
                  } else {
                    setActiveTab('chat');
                  }
                }}
                title="View AI Audit Logs"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
              >
                {activeTab === 'chat' ? 'Audit Logs' : 'Back to Chat'}
              </button>
            )}
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={onClose}
              style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Audit Logs View (for Judges/Admins to verify transparency) */}
        {activeTab === 'logs' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: '700', margin: 0 }}>Recent AI Query Audit Trail</h3>
              <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loadingLogs}>
                <RefreshCw size={14} className={loadingLogs ? 'spin' : ''} /> Refresh
              </button>
            </div>
            {aiLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                No recorded AI logs yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {aiLogs.map(log => (
                  <div key={log.id} style={{
                    padding: '0.875rem',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.8125rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>
                        {log.tool_called || 'direct_reply'}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {log.duration_ms}ms • {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: '600', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                      "{log.prompt}"
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', maxHeight: '60px', overflowY: 'auto' }}>
                      {log.response}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Normal Chat View */
          <>
            {/* Quick Prompt Chips */}
            <div style={{
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.1)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              display: 'flex',
              gap: '0.5rem'
            }}>
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  disabled={loading}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <Sparkles size={12} color="var(--primary)" />
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Messages Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  {/* Tool Badge */}
                  {msg.toolCalled && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.6875rem',
                      fontWeight: '600',
                      color: msg.toolCalled.includes('refusal') ? '#f87171' : 'var(--primary)',
                      marginBottom: '0.25rem',
                      padding: '0.15rem 0.5rem',
                      background: msg.toolCalled.includes('refusal') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      borderRadius: '12px'
                    }}>
                      {msg.toolCalled.includes('refusal') ? (
                        <Shield size={11} />
                      ) : (
                        <Wrench size={11} />
                      )}
                      {msg.toolCalled === 'guardrail_salary_refusal' 
                        ? 'RBAC Privacy Guardrail Triggered' 
                        : `Tool Executed: ${msg.toolCalled}`}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div style={{
                    maxWidth: '85%',
                    padding: '0.875rem 1.125rem',
                    borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.sender === 'user'
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : 'var(--bg-card)',
                    color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    lineHeight: '1.45',
                    fontSize: '0.875rem'
                  }}>
                    {msg.text}

                    {/* Interactive Smart Leave Card */}
                    {msg.smartLeave && (
                      <div style={{
                        marginTop: '0.875rem',
                        padding: '0.875rem',
                        background: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '10px'
                      }}>
                        <div style={{ fontWeight: '700', color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Calendar size={15} /> Prepared Leave Application
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.75rem', marginBottom: '0.625rem' }}>
                          <div><strong>Type:</strong> {msg.smartLeave.leave_type} Leave</div>
                          <div><strong>Days:</strong> {msg.smartLeave.working_days} working days</div>
                          <div><strong>Start:</strong> {msg.smartLeave.start_date}</div>
                          <div><strong>End:</strong> {msg.smartLeave.end_date}</div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <strong>Reason:</strong> {msg.smartLeave.reason}
                          </div>
                        </div>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConfirmSmartLeave(msg.smartLeave)}
                          disabled={confirmingLeave}
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          <CheckCircle size={14} /> 
                          {confirmingLeave ? 'Submitting Leave...' : 'Confirm & Apply Leave (1-Click)'}
                        </button>
                      </div>
                    )}

                    {/* Disclaimer Tag */}
                    {msg.isAiGenerated && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '0.6875rem',
                        color: msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Sparkles size={10} /> AI-generated • Always verify against company policy
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid var(--primary)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Analyzing prompt & executing tools...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-glass)'
            }}>
              <form 
                onSubmit={e => {
                  e.preventDefault();
                  handleSend();
                }}
                style={{ display: 'flex', gap: '0.5rem' }}
              >
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ask in English or Roman Urdu (e.g. kitni chuttiyan bachi hen?)..."
                  value={inputPrompt}
                  onChange={e => setInputPrompt(e.target.value)}
                  disabled={loading}
                  style={{ borderRadius: '24px', paddingLeft: '1rem' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !inputPrompt.trim()}
                  style={{
                    borderRadius: '50%',
                    width: '42px',
                    height: '42px',
                    padding: 0,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
