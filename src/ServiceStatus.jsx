import React, { useState, useEffect } from 'react';
const cockpit = window.cockpit;

const SERVICE_NAMES = ['download-superstation', 'torrent-webui'];

async function discoverService() {
  for (const name of SERVICE_NAMES) {
    try {
      const out = await cockpit.spawn(
        ['systemctl', '--user', 'show',
         '--property=ActiveState,SubState,LoadState',
         `${name}.service`],
        { err: 'ignore' }
      );
      const props = {};
      for (const line of out.split('\n')) {
        const eq = line.indexOf('=');
        if (eq > 0) props[line.slice(0, eq)] = line.slice(eq + 1).trim();
      }
      if (props.LoadState && props.LoadState !== 'not-found') {
        return { name, active: props.ActiveState || 'unknown', sub: props.SubState || '' };
      }
    } catch {}
  }
  return { name: null, active: null, sub: null };
}

export default function ServiceStatus() {
  const [state, setState]     = useState({ name: null, active: null, sub: null });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  async function refresh() {
    const s = await discoverService();
    setState(s);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  async function toggleService() {
    if (!state.name || toggling) return;
    setToggling(true);
    try {
      const method = state.active === 'active' ? 'stop' : 'start';
      await cockpit.spawn(['systemctl', '--user', method, `${state.name}.service`]);
      await refresh();
    } catch {} finally {
      setToggling(false);
    }
  }

  if (loading || !state.name) return null;

  const isRunning = state.active === 'active';
  const variant   = isRunning ? 'running' : (state.active === 'failed' ? 'stopped' : 'unknown');
  const label     = isRunning
    ? `${state.name} — running (${state.sub})`
    : `${state.name} — ${state.active}`;

  return (
    <div className={`ds-service-banner ${variant}`}>
      <div className={`ds-service-dot ${variant}`} />
      <span style={{ flex: 1 }}>{label}</span>
      <button className="ds-btn sm" onClick={toggleService} disabled={toggling}>
        {isRunning ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
