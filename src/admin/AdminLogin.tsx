import React, { useState } from 'react';
import '../auth/style.css';
import styles from './Admin.module.css';
import { adminLogin, errorMessage } from '@/api';

interface Props {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Enter the admin password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await adminLogin(password);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err, 'Sign-in failed. Please try again.'));
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-fullscreen-split">
      <div className="auth-form-panel">
        <div className="auth-form-content">
          <div className="auth-header">
            <span className={styles.loginBadge}>Admin console</span>
            <h1 className="auth-title">MedTriage AI</h1>
            <p className="auth-subtitle">Enter the facility admin password to manage verified practitioners.</p>
          </div>

          {error && (
            <div className="auth-error-banner" role="alert">
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="admin-password" className="form-label">
                Admin password
              </label>
              <div className="input-wrapper">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input form-input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
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
              {isLoading ? 'Checking…' : 'Continue'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Only facility administrators should use this page. <a href="/" className={styles.footerLink}>Back to staff sign-in</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
