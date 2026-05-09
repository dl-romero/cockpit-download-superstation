import React, { useState, useEffect } from 'react';
import * as api from './api';

export default function SettingsModal({ onClose, onAuthError }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const [curPw, setCurPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [username, setUName] = useState('admin');
  const [pwMsg, setPwMsg]   = useState({ text: '', ok: false });
  const [pwLoading, setPwLoading] = useState(false);

  const [version, setVersion]   = useState(null);
  const [updateMsg, setUpdateMsg] = useState({ text: '', status: '' });
  const [updating, setUpdating]   = useState(false);

  useEffect(() => {
    Promise.all([api.getSettings(), api.getVersion()])
      .then(([s, v]) => { setSettings(s); setVersion(v); setLoading(false); })
      .catch(e => {
        if (e.status === 401) onAuthError();
        setLoading(false);
      });
  }, []);

  function field(key) {
    return {
      value: settings?.[key] ?? '',
      onChange: e => {
        const raw = e.target.value;
        const num = parseFloat(raw);
        setSettings(s => ({ ...s, [key]: isNaN(num) ? raw : num }));
      },
    };
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await api.updateSettings({
        download_path:        settings.download_path,
        max_download_speed:   parseInt(settings.max_download_speed)   || 0,
        max_upload_speed:     parseInt(settings.max_upload_speed)     || 0,
        max_active_downloads: parseInt(settings.max_active_downloads) || 0,
        max_active_seeds:     parseInt(settings.max_active_seeds)     || 0,
        seed_ratio_limit:     parseFloat(settings.seed_ratio_limit)   || 0,
        seed_time_limit:      parseInt(settings.seed_time_limit)      || 0,
      });
      onClose();
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      setError(e.message);
    } finally { setSaving(false); }
  }

  async function handleChangePw() {
    setPwMsg({ text: '', ok: false });
    if (!curPw || !newPw) { setPwMsg({ text: 'Fill in both password fields.', ok: false }); return; }
    setPwLoading(true);
    try {
      await api.changePassword(curPw, newPw, username);
      setPwMsg({ text: 'Password changed.', ok: true });
      setCurPw(''); setNewPw('');
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      setPwMsg({ text: e.message, ok: false });
    } finally { setPwLoading(false); }
  }

  async function handleUpdate() {
    setUpdating(true); setUpdateMsg({ text: '', status: '' });
    try {
      const d = await api.triggerUpdate();
      setUpdateMsg({ text: d.message, status: d.status });
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      setUpdateMsg({ text: e.message, status: 'error' });
    } finally { setUpdating(false); }
  }

  return (
    <div className="ds-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ds-modal ds-modal-wide">
        <div className="ds-modal-header">
          <h2>Settings</h2>
          <button className="ds-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ds-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--pf-v5-global--Color--200)' }}>Loading…</div>
          ) : (
            <>
              {/* Storage */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">Storage</div>
                <div className="ds-settings-row">
                  <label className="ds-label">Default Download Path</label>
                  <input className="ds-input" type="text" {...field('download_path')} placeholder="/downloads" />
                </div>
              </div>

              {/* Speed limits */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">Speed Limits</div>
                <div className="ds-settings-inline">
                  <div>
                    <label className="ds-label">Max Download Speed</label>
                    <div className="ds-settings-input-unit">
                      <input className="ds-input" type="number" {...field('max_download_speed')} min="0" />
                      <span className="ds-unit-label">KB/s</span>
                    </div>
                    <div className="ds-settings-hint">0 = unlimited</div>
                  </div>
                  <div>
                    <label className="ds-label">Max Upload Speed</label>
                    <div className="ds-settings-input-unit">
                      <input className="ds-input" type="number" {...field('max_upload_speed')} min="0" />
                      <span className="ds-unit-label">KB/s</span>
                    </div>
                    <div className="ds-settings-hint">0 = unlimited</div>
                  </div>
                </div>
              </div>

              {/* Active limits */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">Active Torrent Limits</div>
                <div className="ds-settings-inline">
                  <div>
                    <label className="ds-label">Max Active Downloads</label>
                    <input className="ds-input" type="number" {...field('max_active_downloads')} min="0" />
                    <div className="ds-settings-hint">0 = unlimited</div>
                  </div>
                  <div>
                    <label className="ds-label">Max Active Seeds</label>
                    <input className="ds-input" type="number" {...field('max_active_seeds')} min="0" />
                    <div className="ds-settings-hint">0 = unlimited</div>
                  </div>
                </div>
              </div>

              {/* Seeding limits */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">Seeding Limits</div>
                <div className="ds-settings-inline">
                  <div>
                    <label className="ds-label">Stop at Ratio</label>
                    <input className="ds-input" type="number" {...field('seed_ratio_limit')} min="0" step="0.1" />
                    <div className="ds-settings-hint">0 = seed forever</div>
                  </div>
                  <div>
                    <label className="ds-label">Stop after (minutes)</label>
                    <input className="ds-input" type="number" {...field('seed_time_limit')} min="0" />
                    <div className="ds-settings-hint">0 = no time limit</div>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">Security</div>
                <div className="ds-settings-row">
                  <label className="ds-label">Username</label>
                  <input className="ds-input" type="text" value={username} onChange={e => setUName(e.target.value)} autoComplete="off" />
                </div>
                <div className="ds-settings-inline" style={{ marginBottom: 10 }}>
                  <div>
                    <label className="ds-label">Current Password</label>
                    <input className="ds-input" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} autoComplete="current-password" />
                  </div>
                  <div>
                    <label className="ds-label">New Password</label>
                    <input className="ds-input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="ds-btn sm" onClick={handleChangePw} disabled={pwLoading}>
                    {pwLoading ? 'Saving…' : 'Change Password'}
                  </button>
                  {pwMsg.text && <span className={`ds-pw-msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.text}</span>}
                </div>
              </div>

              {/* About & Update */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">About</div>
                {version && (
                  <div style={{ fontSize: 12, color: 'var(--pf-v5-global--Color--200)', marginBottom: 10 }}>
                    Version {version.commit} — {version.date}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="ds-btn sm" onClick={handleUpdate} disabled={updating}>
                    {updating ? 'Checking…' : 'Check for Updates'}
                  </button>
                  {updateMsg.text && (
                    <span style={{ fontSize: 12, color: updateMsg.status === 'updated' || updateMsg.status === 'up_to_date' ? '#4caf50' : 'var(--pf-v5-global--danger-color--100)' }}>
                      {updateMsg.text}
                    </span>
                  )}
                </div>
              </div>

              {/* Cockpit plugin port */}
              <div className="ds-settings-section">
                <div className="ds-settings-section-title">Cockpit Plugin</div>
                <div className="ds-settings-row">
                  <label className="ds-label">Service Port</label>
                  <div className="ds-settings-input-unit">
                    <input
                      className="ds-input"
                      type="number"
                      defaultValue={api.getPort()}
                      min="1" max="65535"
                      id="cockpit-port-input"
                    />
                    <button className="ds-btn sm" onClick={() => {
                      const p = parseInt(document.getElementById('cockpit-port-input').value) || 8080;
                      api.setPort(p);
                    }}>
                      Apply
                    </button>
                  </div>
                  <div className="ds-settings-hint">Port where Download Superstation is running on this server.</div>
                </div>
              </div>

              {error && <div className="ds-error">{error}</div>}
            </>
          )}
        </div>

        <div className="ds-modal-footer">
          <button className="ds-btn" onClick={onClose}>Cancel</button>
          <button className="ds-btn primary" onClick={handleSave} disabled={saving || loading || !settings}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
