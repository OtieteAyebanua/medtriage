'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Auth, { HealthcareWorker } from '@/auth';
import Homescreen from '@/Homescreen';

const STORAGE_KEY = 'medtriage_user';
const STORAGE_EXPIRY_KEY = 'medtriage_user_expiry';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function clearLocalSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_EXPIRY_KEY);
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<HealthcareWorker | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // On mount: check localStorage for cached user, then validate against backend session.
  // Uses an `ignore` flag so that stale calls (React Strict Mode double-mount) are no-ops.
  useEffect(() => {
    let ignore = false;

    const restoreSession = async () => {
      try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        const storedExpiry = localStorage.getItem(STORAGE_EXPIRY_KEY);

        if (storedUser && storedExpiry) {
          const expiryTime = parseInt(storedExpiry, 10);

          // Check if localStorage cache is expired
          if (Date.now() > expiryTime) {
            clearLocalSession();
            if (!ignore) setIsCheckingSession(false);
            return;
          }

          // Validate the server-side session cookie
          const res = await fetch('/api/auth/session');
          if (ignore) return;       // component unmounted during fetch — bail out

          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.worker) {
              setCurrentUser(data.worker);
              setIsCheckingSession(false);
              return;
            }
          }

          // Server session invalid — clear local cache
          clearLocalSession();
        }
      } catch (err) {
        console.error('Session restore failed:', err);
        clearLocalSession();
      }

      if (!ignore) setIsCheckingSession(false);
    };

    restoreSession();
    return () => { ignore = true; };
  }, []);

  const handleLoginSuccess = useCallback((worker: HealthcareWorker) => {
    // Save to localStorage with 1-day TTL
    localStorage.setItem(STORAGE_KEY, JSON.stringify(worker));
    localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
    setCurrentUser(worker);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    clearLocalSession();
    setCurrentUser(null);
  }, []);

  // Show a loading state while checking the session
  if (isCheckingSession) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: '#f8f5ee',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid #eae5d9',
            borderTopColor: '#0d9488', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
          }} />
          <p style={{ color: '#78716c', fontSize: '0.9rem', fontWeight: 500 }}>
            Restoring session...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Homescreen
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}
