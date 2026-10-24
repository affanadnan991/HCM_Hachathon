import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, Clock, ShieldCheck, MapPin, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function FirstRunSetup() {
  const { setupFirstRun } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    companyName: 'Saylani HCM Technologies',
    currency: 'PKR',
    officeStartTime: '09:00',
    gracePeriod: 15,
    halfDayHours: 5.0,
    weekendDays: ['Saturday', 'Sunday'],
    officeLat: 24.8607, // Default Karachi (Zaitoon Ashraf IT Park coordinates)
    officeLng: 67.0011,
    officeRadius: 150,
    adminEmail: 'admin@hcmlite.com',
    adminPassword: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({
            ...prev,
            officeLat: Number(pos.coords.latitude.toFixed(6)),
            officeLng: Number(pos.coords.longitude.toFixed(6))
          }));
        },
        () => {
          alert('Could not retrieve current location. Using default coordinates.');
        }
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.adminPassword.length < 6) {
      setError('Admin password must be at least 6 characters long.');
      return;
    }

    if (formData.adminPassword !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setupFirstRun({
        companyName: formData.companyName,
        adminEmail: formData.adminEmail,
        adminPassword: formData.adminPassword,
        officeStartTime: formData.officeStartTime,
        gracePeriod: formData.gracePeriod,
        halfDayHours: formData.halfDayHours,
        weekendDays: formData.weekendDays,
        officeLat: formData.officeLat,
        officeLng: formData.officeLng,
        officeRadius: formData.officeRadius
      });
    } catch (err) {
      setError(err.message || 'Setup failed. Please check inputs.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="glass-card" style={{ maxWidth: '640px', width: '100%', padding: '2.5rem' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: 'white',
            marginBottom: '1rem',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
          }}>
            <Sparkles size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>Initial Company Setup</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            Welcome to HCM Lite! The system starts empty. Configure your organization and create the root Admin account.
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          position: 'relative'
        }}>
          {[
            { num: 1, label: 'Company', icon: Building2 },
            { num: 2, label: 'Timing', icon: Clock },
            { num: 3, label: 'Location', icon: MapPin },
            { num: 4, label: 'Admin', icon: ShieldCheck }
          ].map(s => {
            const Icon = s.icon;
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            return (
              <div key={s.num} style={{ textAlign: 'center', zIndex: 2, flex: 1 }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  margin: '0 auto 0.35rem auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'var(--surface-solid)',
                  border: `2px solid ${isActive ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'var(--border)'}`,
                  color: (isActive || isCompleted) ? 'white' : 'var(--text-muted)',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  transition: 'all 0.3s'
                }}>
                  {isCompleted ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
                }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem',
            color: '#f87171',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Company Profile */}
          {step === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  className="form-input"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="e.g. Acme Corporation"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Operating Currency</label>
                <select name="currency" className="form-select" value={formData.currency} onChange={handleChange}>
                  <option value="PKR">Pakistani Rupee (PKR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="GBP">British Pound (GBP)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                  Next: Office Timing <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Office Timing */}
          {step === 2 && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Office Start Time *</label>
                  <input
                    type="time"
                    name="officeStartTime"
                    className="form-input"
                    value={formData.officeStartTime}
                    onChange={handleChange}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Default: 09:00 AM</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Grace Period (Minutes) *</label>
                  <input
                    type="number"
                    name="gracePeriod"
                    className="form-input"
                    min="0"
                    max="60"
                    value={formData.gracePeriod}
                    onChange={handleChange}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Late after start + grace (09:15)</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Half-Day Threshold (Hours) *</label>
                <input
                  type="number"
                  step="0.5"
                  name="halfDayHours"
                  className="form-input"
                  min="1"
                  max="12"
                  value={formData.halfDayHours}
                  onChange={handleChange}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Marked half-day if work hours &lt; 5.0 h</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                  Next: Geofence <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Location & Geofence */}
          {step === 3 && (
            <div>
              <div style={{
                background: 'var(--surface-hover)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}>
                📍 Office GPS coordinates determine the geofence perimeter for camera and mobile check-ins.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    name="officeLat"
                    className="form-input"
                    value={formData.officeLat}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    name="officeLng"
                    className="form-input"
                    value={formData.officeLng}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Allowed Geofence Radius (Meters) *</label>
                <input
                  type="number"
                  name="officeRadius"
                  className="form-input"
                  min="20"
                  max="5000"
                  value={formData.officeRadius}
                  onChange={handleChange}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Employees must be within {formData.officeRadius} meters to check-in</span>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleUseCurrentLocation}
                style={{ marginBottom: '1.5rem' }}
              >
                <MapPin size={14} /> Detect My Current GPS Location
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
                  Next: Admin Account <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Root Admin Account */}
          {step === 4 && (
            <div>
              <div className="form-group">
                <label className="form-label">Admin Email *</label>
                <input
                  type="email"
                  name="adminEmail"
                  className="form-input"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  placeholder="admin@company.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Admin Password *</label>
                <input
                  type="password"
                  name="adminPassword"
                  className="form-input"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum 6 characters</span>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="form-input"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(3)} disabled={loading}>
                  <ArrowLeft size={16} /> Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Initializing System...' : 'Finish Setup & Launch'} <Sparkles size={16} />
                </button>
              </div>
            </div>
          )}
        </form>

      </div>
    </div>
  );
}
