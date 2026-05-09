import React, { useState, useEffect } from 'react';
const cockpit = window.cockpit;

const SERVICE_NAMES = ['download-superstation', 'torrent-webui'];

export default function ServiceStatus() {
  const [state, setState]   = useState({ name: null, active: null, sub: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = cockpit.dbus('org.freedesktop.systemd1', { superuser: 'try' });
    let unitProxy = null;
    let cancelled = false;

    async function discover() {
      for (const name of SERVICE_NAMES) {
        try {
          const [path] = await client.call(
            '/org/freedesktop/systemd1',
            'org.freedesktop.systemd1.Manager',
            'LoadUnit',
            [`${name}.service`]
          );
          if (cancelled) return;
          unitProxy = client.proxy('org.freedesktop.systemd1.Unit', path);
          await unitProxy.wait();
          if (cancelled) return;
          setState({ name, active: unitProxy.ActiveState, sub: unitProxy.SubState });
          setLoading(false);
          unitProxy.addEventListener('changed', () => {
            if (!cancelled) setState({ name, active: unitProxy.ActiveState, sub: unitProxy.SubState });
          });
          return;
        } catch {}
      }
      if (!cancelled) { setState({ name: null, active: null, sub: null }); setLoading(false); }
    }

    discover();
    return () => { cancelled = true; client.close(); };
  }, []);

  async function toggleService() {
    if (!state.name) return;
    const client = cockpit.dbus('org.freedesktop.systemd1', { superuser: 'require' });
    try {
      const method = state.active === 'active' ? 'StopUnit' : 'StartUnit';
      await client.call(
        '/org/freedesktop/systemd1',
        'org.freedesktop.systemd1.Manager',
        method,
        [`${state.name}.service`, 'replace']
      );
    } finally { client.close(); }
  }

  if (loading || !state.name) return null;

  const isRunning = state.active === 'active';
  const variant   = isRunning ? 'running' : (state.active === 'failed' ? 'stopped' : 'unknown');
  const label     = isRunning ? `${state.name} — running (${state.sub})` : `${state.name} — ${state.active}`;

  return (
    <div className={`ds-service-banner ${variant}`}>
      <div className={`ds-service-dot ${variant}`} />
      <span style={{ flex: 1 }}>{label}</span>
      <button className="ds-btn sm" onClick={toggleService}>
        {isRunning ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
