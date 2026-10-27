import React, { useState } from 'react';
import { HealthcareWorker, loginWithCredentials } from './authService';

export type { HealthcareWorker } from './authService';

interface AuthProps {
  onLoginSuccess?: (worker: HealthcareWorker) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const performLogin = async (id: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await loginWithCredentials(id, pass);
      if (res.success && res.worker) {
        onLoginSuccess?.(res.worker);
      } else {
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      setError('Enter your employee ID or email to sign in.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }
    await performLogin(employeeId, password);
  };

  // Demo accounts that exist in the facility database
  const handleQuickDemo = (role: 'doctor' | 'nurse') => {
    const id = role === 'doctor' ? 'HW-DOC-001' : 'HW-NUR-002';
    const pass = 'demo123';
    setEmployeeId(id);
    setPassword(pass);
    performLogin(id, pass);
  };

  return (
    <div className="auth-fullscreen-split">
      {/* Left Half of the Screen: Full Height Image */}
      <div className="auth-image-panel">
        <img
          src="/auth-hero.jpg"
          alt="MedTriage AI Clinical Team"
          className="auth-fullscreen-img"
        />
        <div className="auth-image-overlay">
          <div className="auth-image-caption">
            <h3>Faster, safer triage for every patient</h3>
            <p>AI-assisted urgency scoring that runs entirely on your facility&apos;s local network.</p>
          </div>
        </div>
      </div>

      {/* Right Half of the Screen: Login Form */}
      <div className="auth-form-panel">
        <div className="auth-form-content">
          <div className="auth-header">
            <h1 className="auth-title">MedTriage AI</h1>
            <p className="auth-subtitle">Sign in to start triaging patients</p>
          </div>

          {/* Quick Demo Sign-in Helpers */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f0fdfa',
            border: '1px solid #99f6e4',
            borderRadius: '0.6rem',
            textAlign: 'left'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f766e', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Quick Demo Sign-In
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleQuickDemo('doctor')}
                disabled={isLoading}
                style={{
                  background: '#ffffff',
                  border: '1px solid #0d9488',
                  color: '#0d9488',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                🩺 Dr. Amina Bello (Doctor)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('nurse')}
                disabled={isLoading}
                style={{
                  background: '#ffffff',
                  border: '1px solid #0d9488',
                  color: '#0d9488',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                💉 Grace Okafor (Nurse)
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error-banner" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="employeeId" className="form-label">
                Employee ID or email
              </label>
              <div className="input-wrapper">
                <input
                  id="employeeId"
                  type="text"
                  className="form-input"
                  placeholder="e.g. HW-DOC-001 or HW-NUR-002"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input form-input-password"
                  placeholder="Your password or access PIN"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Sign-in is verified against the facility&apos;s local staff records — no internet connection required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
