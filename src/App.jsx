import React, { useState, useEffect } from 'react';
import * as api from './api';
import TorrentManager from './TorrentManager';

export default function App() {
  const [state, setState] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api.initAuth()
      .then(() => setState('ready'))
      .catch(e => { setErrorMsg(e.message || 'Initialisation failed'); setState('error'); });
  }, []);

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>Connecting…</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Could not connect to Download Superstation</div>
          <div style={{ color: 'var(--pf-v5-global--Color--200)', fontSize: 13, marginBottom: 20 }}>{errorMsg}</div>
          <button className="ds-btn primary" onClick={() => { setState('loading'); api.initAuth().then(() => setState('ready')).catch(e => { setErrorMsg(e.message); setState('error'); }); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  function handleAuthError() {
    setErrorMsg('Session expired or service restarted. Click Retry to reconnect.');
    setState('error');
  }

  return <TorrentManager onAuthError={handleAuthError} />;
}
