import React, { useState, useCallback } from 'react';
import Auth, { HealthcareWorker } from '@/auth';
import Homescreen from '@/Homescreen';

const STORAGE_KEY = 'medtriage_user';
const STORAGE_EXPIRY_KEY = 'medtriage_user_expiry';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function clearLocalSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_EXPIRY_KEY);
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<HealthcareWorker | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const expiry = localStorage.getItem(STORAGE_EXPIRY_KEY);
      if (stored && expiry && Date.now() <= parseInt(expiry, 10)) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const handleLoginSuccess = useCallback((worker: HealthcareWorker) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(worker));
    localStorage.setItem(STORAGE_EXPIRY_KEY, String(Date.now() + SESSION_TTL_MS));
    setCurrentUser(worker);
  }, []);

  const handleLogout = useCallback(() => {
    clearLocalSession();
    setCurrentUser(null);
  }, []);

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
