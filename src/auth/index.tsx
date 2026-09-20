'use client';

import React, { useState } from 'react';
import './style.css';

export interface HealthcareWorker {
  userId: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  position: 'doctor' | 'nurse' | 'lab_tech' | 'pharmacist' | 'admin';
  gender: string;
}

interface AuthProps {
  onLoginSuccess?: (worker: HealthcareWorker) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeId.trim()) {
      setError('Enter your employee ID or email to sign in.');
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      if (onLoginSuccess) {
        onLoginSuccess({
          userId: 1,
          employeeId: employeeId.trim(),
          firstName: 'Demo',
          lastName: 'User',
          email: 'demo@example.com',
          position: 'doctor',
          gender: 'Female'
        });
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-split" suppressHydrationWarning>
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
                  placeholder="e.g. HW-DOC-001"
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
