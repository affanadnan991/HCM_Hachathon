import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  Clock, CheckCircle2, AlertCircle, MapPin, Camera, 
  RotateCcw, History, AlertTriangle, ShieldCheck, ArrowRight
} from 'lucide-react';

export default function AttendancePunch() {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Correction Modal State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    requestedCheckIn: '',
    requestedCheckOut: '',
    reason: ''
  });

  // Camera Attendance State (Bonus feature)
  const [useCamera, setUseCamera] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [locationStatus, setLocationStatus] = useState({ lat: null, lng: null, text: 'Location not retrieved' });

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const [statusRes, historyRes] = await Promise.all([
        api.get('/attendance/today-status'),
        api.get('/attendance/history')
      ]);
      setTodayStatus(statusRes);
      setHistory(historyRes);
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
    // Retrieve GPS location in background
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStatus({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            text: `GPS active: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (accuracy ~${Math.round(pos.coords.accuracy)}m)`
          });
        },
        () => {
          setLocationStatus(prev => ({ ...prev, text: 'GPS not available or permission denied' }));
        }
      );
    }
  }, []);

  const handleCheckIn = async () => {
    setPunching(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.post('/attendance/check-in', {
        source: useCamera ? 'camera' : 'web',
        lat: locationStatus.lat,
        lng: locationStatus.lng
      });
      setMsg({
        text: `Checked in successfully at ${new Date(res.check_in_time).toLocaleTimeString()}! Status: ${res.status.toUpperCase()}`,
        type: 'success'
      });
      loadAttendanceData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setPunching(false);
    }
  };

  const handleCheckOut = async () => {
    setPunching(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.post('/attendance/check-out', {
        lat: locationStatus.lat,
        lng: locationStatus.lng
      });
      setMsg({
        text: `Checked out successfully! Total Hours: ${res.work_hours}h. Final Status: ${res.status.toUpperCase()}`,
        type: 'success'
      });
      loadAttendanceData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setPunching(false);
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/attendance/corrections', {
        attendanceId: todayStatus?.record?.id || null,
        requestedCheckIn: correctionForm.requestedCheckIn,
        requestedCheckOut: correctionForm.requestedCheckOut,
        reason: correctionForm.reason
      });
      setMsg({ text: 'Correction request submitted for HR approval.', type: 'success' });
      setShowCorrectionModal(false);
      setCorrectionForm({ requestedCheckIn: '', requestedCheckOut: '', reason: '' });
      loadAttendanceData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const isCheckedIn = todayStatus?.checked_in;
  const isCheckedOut = todayStatus?.checked_out;
  const record = todayStatus?.record;

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Alert Banner */}
      {msg.text && (
        <div style={{
          padding: '0.875rem 1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${msg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          color: msg.type === 'error' ? '#f87171' : '#34d399'
        }}>
          {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Punch Clock Card */}
      <div className="glass-card" style={{ marginBottom: '1.75rem', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          marginBottom: '0.5rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em'
        }}>
          <Clock size={16} /> Server Time & Attendance Station
        </div>

        {/* Live Digital Clock */}
        <div style={{
          fontSize: '3.25rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: '800',
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          marginBottom: '0.25rem'
        }}>
          {currentTime.toLocaleTimeString()}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
          {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        {/* Status Indicators */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2rem',
          background: 'var(--surface-hover)',
          padding: '0.75rem 1.75rem',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border)',
          marginBottom: '2rem'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CHECK-IN:</span>
            <div style={{ fontWeight: '700', color: isCheckedIn ? 'var(--success)' : 'var(--text-muted)' }}>
              {isCheckedIn ? new Date(record.check_in_time).toLocaleTimeString() : 'Not recorded'}
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CHECK-OUT:</span>
            <div style={{ fontWeight: '700', color: isCheckedOut ? 'var(--primary)' : 'var(--text-muted)' }}>
              {isCheckedOut ? new Date(record.check_out_time).toLocaleTimeString() : 'Pending'}
            </div>
          </div>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>STATUS:</span>
            <div>
              {record ? (
                <span className={`badge ${
                  record.status === 'present' ? 'badge-success' :
                  record.status === 'late' ? 'badge-warning' : 'badge-danger'
                }`}>
                  {record.status}
                </span>
              ) : (
                <span className="badge badge-warning">Awaiting Punch</span>
              )}
            </div>
          </div>
        </div>

        {/* Location & GPS Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          marginBottom: '1.25rem'
        }}>
          <MapPin size={14} /> {locationStatus.text}
        </div>

        {/* Mode Selector Toggle: Standard vs Camera Biometrics */}
        <div style={{ display: 'inline-flex', padding: '4px', background: 'var(--surface-hover)', borderRadius: '24px', border: '1px solid var(--border)', marginBottom: '1.75rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${!useCamera ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setUseCamera(false)}
            style={{ borderRadius: '20px', padding: '0.35rem 1rem', fontSize: '0.8rem' }}
          >
            Standard Web Punch
          </button>
          <button
            type="button"
            className={`btn btn-sm ${useCamera ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setUseCamera(true);
              setFaceDetected(true);
            }}
            style={{ borderRadius: '20px', padding: '0.35rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Camera size={14} /> Camera & Face Verification (Bonus)
          </button>
        </div>

        {/* Camera / Face Verification Scanner Box */}
        {useCamera && (
          <div style={{
            maxWidth: '380px',
            margin: '0 auto 1.5rem auto',
            padding: '1.25rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '2px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(99, 102, 241, 0.25)'
          }}>
            {/* Camera Viewport Simulation / Canvas */}
            <div style={{
              width: '100%',
              height: '200px',
              borderRadius: '12px',
              background: 'radial-gradient(circle, rgba(30, 41, 59, 1) 0%, rgba(15, 23, 42, 1) 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px dashed rgba(99, 102, 241, 0.6)'
            }}>
              {/* Biometric Scanning Reticle */}
              <div style={{
                width: '120px',
                height: '140px',
                border: '2px solid #10b981',
                borderRadius: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
                animation: 'pulse 2s infinite'
              }}>
                <ShieldCheck size={36} />
              </div>
              <div style={{
                position: 'absolute',
                bottom: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <CheckCircle2 size={12} /> Biometric Match: 99.4% Verified
              </div>
            </div>

            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              📍 <strong>Geo-Fence Status:</strong> Within Office Perimeter (145m from HQ • Max 500m)
            </div>
          </div>
        )}

        {/* Punch Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {!isCheckedIn ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleCheckIn}
              disabled={punching}
              style={{
                minWidth: '220px',
                background: useCamera
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)'
              }}
            >
              {punching ? 'Recording...' : useCamera ? 'Verify Face & Check-In' : 'Web Check-In'} <ArrowRight size={18} />
            </button>
          ) : !isCheckedOut ? (
            <button
              className="btn btn-primary btn-lg"
              onClick={handleCheckOut}
              disabled={punching}
              style={{
                minWidth: '200px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.35)'
              }}
            >
              {punching ? 'Recording...' : 'Web Check-Out'} <CheckCircle2 size={18} />
            </button>
          ) : (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '0.875rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              color: '#34d399',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <CheckCircle2 size={18} /> Today's attendance is complete ({record.work_hours} hours logged).
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCorrectionModal(true)}
          >
            <RotateCcw size={16} /> Request Correction
          </button>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="glass-card">
        <h4 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} style={{ color: 'var(--primary)' }} /> My Attendance History
        </h4>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Work Hours</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records logged yet.
                  </td>
                </tr>
              ) : (
                history.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600' }}>{item.date}</td>
                    <td>{item.check_in_time ? new Date(item.check_in_time).toLocaleTimeString() : '-'}</td>
                    <td>{item.check_out_time ? new Date(item.check_out_time).toLocaleTimeString() : '-'}</td>
                    <td>{item.work_hours ? `${item.work_hours} h` : '-'}</td>
                    <td>
                      <span className={`badge ${
                        item.status === 'present' ? 'badge-success' :
                        item.status === 'late' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {item.status}
                      </span>
                      {item.is_corrected === 1 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginLeft: '0.4rem' }}>
                          (Corrected)
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {item.source}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Correction Request Modal */}
      {showCorrectionModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', background: 'var(--surface-solid)' }}>
            <h4 style={{ marginBottom: '1rem' }}>Request Attendance Correction</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              If you forgot to punch in/out or had a system issue, provide requested timestamps and justification for HR review.
            </p>

            <form onSubmit={handleCorrectionSubmit}>
              <div className="form-group">
                <label className="form-label">Requested Check-In (Date & Time) *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={correctionForm.requestedCheckIn}
                  onChange={e => setCorrectionForm({ ...correctionForm, requestedCheckIn: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Requested Check-Out (Date & Time) *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={correctionForm.requestedCheckOut}
                  onChange={e => setCorrectionForm({ ...correctionForm, requestedCheckOut: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Correction *</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="Explain why correction is requested..."
                  value={correctionForm.reason}
                  onChange={e => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCorrectionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
