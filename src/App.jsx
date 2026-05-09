import React, { useState, useEffect } from 'react';
import { Spinner } from '@patternfly/react-core';
import * as api from './api';
import LoginPage from './LoginPage';
import TorrentManager from './TorrentManager';

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | authenticated | unauthenticated

  useEffect(() => {
    if (!api.isAuthenticated()) { setAuthState('unauthenticated'); return; }
    api.getStats()
      .then(() => setAuthState('authenticated'))
      .catch(e => {
        if (e.status === 401) setAuthState('unauthenticated');
        else setAuthState('authenticated'); // service might be down; still show the UI
      });
  }, []);

  function handleLogin() { setAuthState('authenticated'); }

  function handleLogout() {
    api.logout();
    setAuthState('unauthenticated');
  }

  function handleAuthError() {
    api.logout();
    setAuthState('unauthenticated');
  }

  if (authState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <TorrentManager onLogout={handleLogout} onAuthError={handleAuthError} />;
}
