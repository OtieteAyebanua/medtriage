import React, { useCallback, useEffect, useState } from 'react';
import { adminLogout, getAdminSession, UNAUTHENTICATED_EVENT } from '@/api';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

/** The /admin console: password screen first, then the practitioner registry. */
export default function AdminApp() {
  // null while the session check is in flight
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'MedTriage AI · Admin';
    let ignore = false;
    getAdminSession()
      .then((ok) => {
        if (!ignore) setSignedIn(ok);
      })
      .catch(() => {
        if (!ignore) setSignedIn(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // An admin request that finds the session gone returns to the password screen
  useEffect(() => {
    const onUnauthenticated = () => setSignedIn(false);
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const handleLogout = useCallback(async () => {
    await adminLogout();
    setSignedIn(false);
  }, []);

  if (signedIn === null) {
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
        Checking admin session…
      </div>
    );
  }

  if (!signedIn) {
    return <AdminLogin onSuccess={() => setSignedIn(true)} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
