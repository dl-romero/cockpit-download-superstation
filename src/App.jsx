import React, { useState, useEffect } from 'react';
import * as api from './api';
import TorrentManager from './TorrentManager';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // initAuth() reads the service port from the key file if available,
    // then always resolves — auth itself is handled by the server trusting
    // localhost connections from cockpit-bridge.
    api.initAuth().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>Connecting…</span>
      </div>
    );
  }

  function handleAuthError() {
    // 401 from the service means the service was restarted and lost the
    // localhost trust context — shouldn't happen, but reload to recover.
    window.location.reload();
  }

  return <TorrentManager onAuthError={handleAuthError} />;
}
