import React, { useState, useCallback, useEffect } from 'react';
import Auth, { HealthcareWorker } from '@/auth';
import Homescreen from '@/Homescreen';
import { getSession, logout, UNAUTHENTICATED_EVENT } from '@/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState<HealthcareWorker | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Restore the signed-in worker from the session cookie. The `ignore` flag makes the
  // second Strict Mode mount's stale call a no-op.
  useEffect(() => {
    let ignore = false;
    getSession()
      .then((worker) => {
        if (!ignore) setCurrentUser(worker);
      })
      .catch(() => {
        if (!ignore) setCurrentUser(null);
      })
      .finally(() => {
        if (!ignore) setCheckingSession(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Any request that finds the session gone sends the user back to the login screen
  useEffect(() => {
    const onUnauthenticated = () => setCurrentUser(null);
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setCurrentUser(null);
  }, []);

  if (checkingSession) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#f8f5ee',
          color: '#78716c',
          fontSize: '0.9rem',
          fontWeight: 500,
        }}
        role="status"
      >
        Restoring session…
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onLoginSuccess={setCurrentUser} />;
  }

  return <Homescreen currentUser={currentUser} onLogout={handleLogout} />;
}
