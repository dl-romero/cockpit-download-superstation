import React, { useState } from 'react';
import * as api from './api';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [port, setPort]         = useState(String(api.getPort()));
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const p = parseInt(port) || 8080;
    if (p !== api.getPort()) { api.setPort(p); }

    try {
      await api.login(username, password);
      onLogin();
    } catch (ex) {
      setError(ex.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ds-login-wrap">
      <div className="ds-login-card">
        <div className="ds-login-logo">
          <div className="ds-login-logo-icon">DS</div>
          <div>
            <div className="ds-login-title">Download Superstation</div>
            <div className="ds-login-sub">Sign in to continue</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ds-field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="ds-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="ds-port-row">
            <span>Service port:</span>
            <input
              type="number"
              className="ds-input"
              value={port}
              onChange={e => setPort(e.target.value)}
              min="1"
              max="65535"
            />
          </div>

          {error && <div className="ds-error">{error}</div>}

          <button
            type="submit"
            className="ds-btn primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
