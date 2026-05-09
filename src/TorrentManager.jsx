import React, { useState, useEffect, useRef, useCallback } from 'react';
const cockpit = window.cockpit;
import * as api from './api';
import ServiceStatus from './ServiceStatus';
import AddModal from './AddModal';
import SettingsModal from './SettingsModal';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtSpeed(bytesPerSec) {
  if (!bytesPerSec) return '—';
  return fmtSize(bytesPerSec) + '/s';
}

function fmtEta(secs) {
  if (secs == null || secs < 0 || secs > 86400 * 365) return '—';
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtRatio(r) {
  if (r == null) return '—';
  return r.toFixed(2);
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function badgeClass(state) {
  if (!state) return 'ds-badge';
  const s = state.toLowerCase();
  if (s === 'downloading') return 'ds-badge dl';
  if (s === 'seeding') return 'ds-badge seed';
  if (s === 'finished') return 'ds-badge done';
  if (s.includes('paused') || s.includes('stopped')) return 'ds-badge pause';
  if (s.includes('check')) return 'ds-badge check';
  if (s === 'stalled') return 'ds-badge stall';
  if (s === 'queued' || s.includes('queued')) return 'ds-badge meta';
  if (s.includes('metadata')) return 'ds-badge meta';
  if (s === 'error' || s === 'missingfiles') return 'ds-badge err';
  return 'ds-badge';
}

function priorityLabel(p) {
  if (p === 'high') return <span className="ds-priority high">High</span>;
  if (p === 'low')  return <span className="ds-priority low">Low</span>;
  return <span className="ds-priority normal">Normal</span>;
}

function stateLabel(state) {
  if (!state) return null;
  const display = state.charAt(0).toUpperCase() + state.slice(1);
  return <span className={badgeClass(state)}>{display}</span>;
}

// ── FilePriorityModal ─────────────────────────────────────────────────────────

function FilePriorityModal({ torrent, onClose, onAuthError }) {
  const [files, setFiles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priorities, setPriorities] = useState({});

  useEffect(() => {
    api.getTorrentFiles(torrent.id)
      .then(f => {
        setFiles(f);
        const p = {};
        f.forEach(file => { p[file.index] = file.priority ?? 'normal'; });
        setPriorities(p);
        setLoading(false);
      })
      .catch(e => {
        if (e.status === 401) { onAuthError(); return; }
        setFiles([]);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.setFilePriorities(torrent.id, priorities);
      onClose();
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
    } finally { setSaving(false); }
  }

  function setAll(p) {
    const next = {};
    Object.keys(priorities).forEach(k => { next[k] = p; });
    setPriorities(next);
  }

  return (
    <div className="ds-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ds-modal ds-modal-wide">
        <div className="ds-modal-header">
          <h2>File Priorities — {torrent.name}</h2>
          <button className="ds-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="ds-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button className="ds-btn sm" onClick={() => setAll('high')}>All High</button>
                <button className="ds-btn sm" onClick={() => setAll('normal')}>All Normal</button>
                <button className="ds-btn sm" onClick={() => setAll('low')}>All Low</button>
                <button className="ds-btn sm danger" onClick={() => setAll('skip')}>Skip All</button>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="ds-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50%' }}>File</th>
                      <th>Size</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr key={f.index}>
                        <td style={{ wordBreak: 'break-all', fontSize: 11 }}>{f.path}</td>
                        <td>{fmtSize(f.size)}</td>
                        <td>
                          <select
                            className="ds-input"
                            style={{ padding: '2px 4px', fontSize: 12 }}
                            value={priorities[f.index] ?? 'normal'}
                            onChange={e => setPriorities(p => ({ ...p, [f.index]: e.target.value }))}
                          >
                            <option value="high">High</option>
                            <option value="normal">Normal</option>
                            <option value="low">Low</option>
                            <option value="skip">Skip</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="ds-modal-footer">
          <button className="ds-btn" onClick={onClose}>Cancel</button>
          <button className="ds-btn primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ torrents, onConfirm, onClose, defaultDeleteFiles = false }) {
  const [deleteFiles, setDeleteFiles] = useState(defaultDeleteFiles);
  const names = torrents.map(t => t.name);
  return (
    <div className="ds-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ds-modal">
        <div className="ds-modal-header">
          <h2>Remove {torrents.length === 1 ? 'Torrent' : `${torrents.length} Torrents`}</h2>
          <button className="ds-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="ds-modal-body">
          <p style={{ marginBottom: 12, color: 'var(--pf-v5-global--Color--100)' }}>
            Remove {torrents.length === 1 ? <strong>{names[0]}</strong> : `${torrents.length} selected torrents`}?
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={deleteFiles} onChange={e => setDeleteFiles(e.target.checked)} />
            <span>Also delete downloaded files</span>
          </label>
        </div>
        <div className="ds-modal-footer">
          <button className="ds-btn" onClick={onClose}>Cancel</button>
          <button className="ds-btn danger" onClick={() => onConfirm(deleteFiles)}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ torrent, detail, tab, onTabChange }) {
  if (!torrent) return null;

  const progress = torrent.progress ?? 0;
  const ratio    = torrent.ratio ?? 0;

  return (
    <div className="ds-detail">
      <div className="ds-detail-name">{torrent.name}</div>
      <div className="ds-detail-tabs">
        {['general', 'peers', 'trackers'].map(t => (
          <div
            key={t}
            className={`ds-detail-tab${tab === t ? ' active' : ''}`}
            onClick={() => onTabChange(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>

      <div className="ds-detail-body">
        {tab === 'general' && (
          <table className="ds-detail-table">
            <tbody>
              <tr><td>State</td><td>{stateLabel(torrent.state)}</td></tr>
              <tr><td>Priority</td><td>{priorityLabel(torrent.priority)}</td></tr>
              <tr>
                <td>Progress</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="ds-progress-wrap" style={{ flex: 1 }}>
                      <div
                        className={`ds-progress-bar ${badgeClass(torrent.state).replace('ds-badge ', '').replace('ds-badge', '')}`}
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{progress.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
              <tr><td>Size</td><td>{fmtSize(torrent.size)}</td></tr>
              <tr><td>Downloaded</td><td>{fmtSize(torrent.downloaded)}</td></tr>
              <tr><td>Uploaded</td><td>{fmtSize(torrent.uploaded)}</td></tr>
              <tr>
                <td>Ratio</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="ds-ratio-wrap" style={{ flex: 1 }}>
                      <div
                        className={`ds-ratio-bar${ratio >= 1 ? ' good' : ratio >= 0.5 ? '' : ' low'}`}
                        style={{ width: `${Math.min(100, ratio * 50)}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 11 }}>{fmtRatio(torrent.ratio)}</span>
                  </div>
                </td>
              </tr>
              <tr><td>Download Speed</td><td>{fmtSpeed(torrent.download_speed)}</td></tr>
              <tr><td>Upload Speed</td><td>{fmtSpeed(torrent.upload_speed)}</td></tr>
              <tr><td>ETA</td><td>{fmtEta(torrent.eta)}</td></tr>
              <tr><td>Seeds</td><td>{torrent.seeds ?? '—'}</td></tr>
              <tr><td>Peers</td><td>{torrent.peers ?? '—'}</td></tr>
              <tr><td>Save Path</td><td style={{ wordBreak: 'break-all' }}>{torrent.save_path ?? '—'}</td></tr>
              <tr><td>Files</td><td>{detail?.general?.num_files ?? '—'}</td></tr>
              <tr><td>Hash</td><td style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{detail?.general?.hash ?? torrent.id ?? '—'}</td></tr>
            </tbody>
          </table>
        )}

        {tab === 'peers' && (
          <table className="ds-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>IP</th>
                <th>Client</th>
                <th>Down</th>
                <th>Up</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {detail?.peers?.length ? detail.peers.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.ip}</td>
                  <td style={{ fontSize: 11 }}>{p.client}</td>
                  <td>{fmtSpeed(p.down_speed)}</td>
                  <td>{fmtSpeed(p.up_speed)}</td>
                  <td>{p.progress != null ? `${p.progress.toFixed(0)}%` : '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--pf-v5-global--Color--200)', padding: 16 }}>No peers</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'trackers' && (
          <table className="ds-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>URL</th>
                <th>Status</th>
                <th>Peers</th>
              </tr>
            </thead>
            <tbody>
              {detail?.trackers?.length ? detail.trackers.map((t, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11, wordBreak: 'break-all' }}>{t.url}</td>
                  <td style={{ fontSize: 11 }}>{t.status}</td>
                  <td>{t.peers ?? '—'}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--pf-v5-global--Color--200)', padding: 16 }}>No trackers</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── TorrentManager ────────────────────────────────────────────────────────────

const SORT_DEFAULTS = { name: true, state: true, size: false, progress: false,
  download_speed: false, upload_speed: false, uploaded: false, ratio: false,
  eta: true, priority: true };

const CATEGORIES = [
  { key: 'all',         label: 'All' },
  { key: 'downloading', label: 'Downloading' },
  { key: 'seeding',     label: 'Seeding' },
  { key: 'finished',    label: 'Finished' },
  { key: 'paused',      label: 'Paused' },
  { key: 'error',       label: 'Error' },
];

function matchesCategory(t, cat) {
  if (cat === 'all') return true;
  const s = (t.state || '').toLowerCase();
  if (cat === 'downloading') return s === 'downloading' || s === 'stalled' || s.includes('metadata');
  if (cat === 'seeding')     return s === 'seeding';
  if (cat === 'finished')    return s === 'finished';
  if (cat === 'paused')      return s.includes('paused') || s.includes('stopped');
  if (cat === 'error')       return s === 'error' || s === 'missingfiles';
  return true;
}

export default function TorrentManager({ onLogout, onAuthError }) {
  const [torrents,        setTorrents]        = useState([]);
  const [stats,           setStats]           = useState(null);
  const [selected,        setSelected]        = useState(new Set());
  const [filterCategory,  setFilterCategory]  = useState('all');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [sortKey,         setSortKey]         = useState('name');
  const [sortAsc,         setSortAsc]         = useState(true);
  const [detailId,        setDetailId]        = useState(null);
  const [detailTab,       setDetailTab]       = useState('general');
  const [detailData,      setDetailData]      = useState(null);
  const [addOpen,         setAddOpen]         = useState(false);
  const [settingsOpen,    setSettingsOpen]    = useState(false);
  const [fileModalTorrent,setFileModalTorrent]= useState(null);
  const [deleteTargets,   setDeleteTargets]   = useState(null);
  const [deleteFilesDefault, setDeleteFilesDefault] = useState(false);
  const [contextMenu,     setContextMenu]     = useState(null); // { x, y, torrent }
  const [error,           setError]           = useState('');

  const pollRef = useRef(null);
  const hiddenRef = useRef(false);

  // ── Polling ────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [ts, st] = await Promise.all([api.getTorrents(), api.getStats()]);
      setTorrents(ts);
      setStats(st);
      setError('');
    } catch (e) {
      if (e.status === 401) { onAuthError(); return; }
      setError(e.message || 'Connection error');
    }
  }, [onAuthError]);

  useEffect(() => {
    fetchAll();

    function schedule() {
      pollRef.current = setTimeout(async () => {
        if (!hiddenRef.current) await fetchAll();
        schedule();
      }, 2000);
    }
    schedule();

    function onVisibility() {
      hiddenRef.current = cockpit.hidden;
      if (!cockpit.hidden) fetchAll();
    }
    cockpit.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(pollRef.current);
      cockpit.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAll]);

  // ── Detail fetch ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!detailId) { setDetailData(null); return; }
    api.getTorrentDetail(detailId)
      .then(setDetailData)
      .catch(e => { if (e.status === 401) onAuthError(); });
  }, [detailId, torrents]);

  // ── Context menu dismiss ───────────────────────────────────────────────────

  useEffect(() => {
    if (!contextMenu) return;
    function dismiss() { setContextMenu(null); }
    window.addEventListener('click', dismiss);
    window.addEventListener('blur', dismiss);
    return () => { window.removeEventListener('click', dismiss); window.removeEventListener('blur', dismiss); };
  }, [contextMenu]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = torrents
    .filter(t => matchesCategory(t, filterCategory))
    .filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av == null) av = sortKey === 'name' ? '' : -1;
      if (bv == null) bv = sortKey === 'name' ? '' : -1;
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });

  const counts = {};
  CATEGORIES.forEach(c => {
    counts[c.key] = c.key === 'all' ? torrents.length : torrents.filter(t => matchesCategory(t, c.key)).length;
  });

  const selectedTorrents = torrents.filter(t => selected.has(t.id));
  const anySelected = selected.size > 0;
  const canResume = anySelected && selectedTorrents.some(t => {
    const s = (t.state || '').toLowerCase();
    return s.includes('paused') || s.includes('stopped');
  });
  const canPause = anySelected && selectedTorrents.some(t => {
    const s = (t.state || '').toLowerCase();
    return !s.includes('paused') && !s.includes('stopped');
  });

  const detailTorrent = torrents.find(t => t.id === detailId) ?? null;

  // ── Actions ────────────────────────────────────────────────────────────────

  async function doResume(ids) {
    try { await Promise.all(ids.map(api.resumeTorrent)); await fetchAll(); }
    catch (e) { if (e.status === 401) onAuthError(); }
  }

  async function doPause(ids) {
    try { await Promise.all(ids.map(api.pauseTorrent)); await fetchAll(); }
    catch (e) { if (e.status === 401) onAuthError(); }
  }

  async function doDelete(targets, deleteFiles) {
    try {
      await Promise.all(targets.map(t => api.removeTorrent(t.id, deleteFiles)));
      setSelected(s => { const n = new Set(s); targets.forEach(t => n.delete(t.id)); return n; });
      if (targets.some(t => t.id === detailId)) setDetailId(null);
      await fetchAll();
    } catch (e) { if (e.status === 401) onAuthError(); }
    setDeleteTargets(null);
  }

  async function doSetPriority(id, priority) {
    try { await api.setPriority(id, priority); await fetchAll(); }
    catch (e) { if (e.status === 401) onAuthError(); }
  }

  // ── Sort toggle ────────────────────────────────────────────────────────────

  function handleSort(key) {
    if (sortKey === key) { setSortAsc(a => !a); }
    else { setSortKey(key); setSortAsc(SORT_DEFAULTS[key] ?? true); }
  }

  function sortIcon(key) {
    if (sortKey !== key) return <span className="ds-sort-icon">↕</span>;
    return <span className="ds-sort-icon active">{sortAsc ? '↑' : '↓'}</span>;
  }

  // ── Row selection ──────────────────────────────────────────────────────────

  function handleRowClick(e, t) {
    if (e.target.type === 'checkbox') return;
    if (e.ctrlKey || e.metaKey) {
      setSelected(s => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
    } else {
      setSelected(new Set([t.id]));
      setDetailId(prev => prev === t.id && selected.size === 1 ? null : t.id);
      if (detailId !== t.id) setDetailTab('general');
    }
  }

  function handleRowCtxMenu(e, t) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, torrent: t });
  }

  function handleSelectAll(e) {
    if (e.target.checked) setSelected(new Set(filtered.map(t => t.id)));
    else setSelected(new Set());
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ds-layout" onClick={() => contextMenu && setContextMenu(null)}>
      {/* Sidebar */}
      <nav className="ds-sidebar">
        <div className="ds-sidebar-logo">
          <span className="ds-sidebar-logo-icon">DS</span>
          <span className="ds-sidebar-logo-text">Download<br />Superstation</span>
        </div>

        <div className="ds-sidebar-nav">
          {CATEGORIES.map(c => (
            <div
              key={c.key}
              className={`ds-sidebar-item${filterCategory === c.key ? ' active' : ''}`}
              onClick={() => { setFilterCategory(c.key); setSelected(new Set()); }}
            >
              <span>{c.label}</span>
              {counts[c.key] > 0 && <span className="ds-sidebar-count">{counts[c.key]}</span>}
            </div>
          ))}
        </div>

        <div className="ds-sidebar-bottom">
          <button className="ds-btn sm" onClick={() => setSettingsOpen(true)} style={{ width: '100%', justifyContent: 'center' }}>
            ⚙ Settings
          </button>
          <button className="ds-btn sm" onClick={onLogout} style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="ds-main">
        <ServiceStatus />

        {/* Toolbar */}
        <div className="ds-toolbar">
          <button className="ds-btn primary sm" onClick={() => setAddOpen(true)}>+ Add</button>
          <button
            className="ds-btn sm"
            disabled={!canResume}
            onClick={() => doResume([...selected])}
          >▶ Resume</button>
          <button
            className="ds-btn sm"
            disabled={!canPause}
            onClick={() => doPause([...selected])}
          >⏸ Pause</button>
          <button
            className="ds-btn sm danger"
            disabled={!anySelected}
            onClick={() => { setDeleteFilesDefault(false); setDeleteTargets(selectedTorrents); }}
          >✕ Remove</button>
          <div style={{ flex: 1 }} />
          <input
            className="ds-input ds-search"
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {error && <div className="ds-error" style={{ margin: '0 0 8px' }}>{error}</div>}

        {/* Table + Detail */}
        <div className={`ds-content${detailId ? ' ds-has-detail' : ''}`}>
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(t => selected.has(t.id))}
                      onChange={handleSelectAll}
                    />
                  </th>
                  {[
                    { key: 'name',           label: 'Name',      style: { minWidth: 180 } },
                    { key: 'priority',       label: 'Pri',       style: { width: 60 } },
                    { key: 'size',           label: 'Size',      style: { width: 80 } },
                    { key: 'state',          label: 'State',     style: { width: 100 } },
                    { key: 'progress',       label: 'Progress',  style: { width: 120 } },
                    { key: 'download_speed', label: 'Down',      style: { width: 80 } },
                    { key: 'upload_speed',   label: 'Up',        style: { width: 80 } },
                    { key: 'ratio',          label: 'Ratio',     style: { width: 70 } },
                    { key: 'eta',            label: 'ETA',       style: { width: 70 } },
                  ].map(col => (
                    <th key={col.key} style={col.style} onClick={() => handleSort(col.key)} className="ds-th-sort">
                      {col.label} {sortIcon(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--pf-v5-global--Color--200)' }}>
                      {torrents.length === 0 ? 'No torrents. Click + Add to get started.' : 'No torrents match this filter.'}
                    </td>
                  </tr>
                ) : filtered.map(t => {
                  const prog = t.progress ?? 0;
                  const isSelected = selected.has(t.id);
                  const isActive = detailId === t.id;
                  const stateKey = badgeClass(t.state).replace('ds-badge ', '').replace('ds-badge', 'done');
                  return (
                    <tr
                      key={t.id}
                      className={`${isSelected ? 'selected' : ''}${isActive ? ' active' : ''}`}
                      onClick={e => handleRowClick(e, t)}
                      onContextMenu={e => handleRowCtxMenu(e, t)}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => setSelected(s => { const n = new Set(s); e.target.checked ? n.add(t.id) : n.delete(t.id); return n; })}
                        />
                      </td>
                      <td className="ds-col-name" title={t.name}>{t.name}</td>
                      <td>{priorityLabel(t.priority)}</td>
                      <td>{fmtSize(t.size)}</td>
                      <td>{stateLabel(t.state)}</td>
                      <td>
                        <div className="ds-progress-wrap">
                          <div className={`ds-progress-bar ${stateKey}`} style={{ width: `${Math.min(100, prog)}%` }} />
                        </div>
                        <div className="ds-progress-pct">{prog.toFixed(1)}%</div>
                      </td>
                      <td>{fmtSpeed(t.download_speed)}</td>
                      <td>{fmtSpeed(t.upload_speed)}</td>
                      <td>{fmtRatio(t.ratio)}</td>
                      <td>{fmtEta(t.eta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {detailId && (
            <div className="ds-detail-wrap">
              <button className="ds-detail-close" onClick={() => setDetailId(null)}>×</button>
              <DetailPanel
                torrent={detailTorrent}
                detail={detailData}
                tab={detailTab}
                onTabChange={setDetailTab}
              />
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="ds-statusbar">
          {stats ? (
            <>
              <span>↓ {fmtSpeed(stats.download_speed)}</span>
              <span>↑ {fmtSpeed(stats.upload_speed)}</span>
              <span>{stats.count ?? torrents.length} torrent{(stats.count ?? torrents.length) !== 1 ? 's' : ''}</span>
              {stats.disk_free != null && <span>Free: {fmtSize(stats.disk_free)}</span>}
            </>
          ) : (
            <span style={{ color: 'var(--pf-v5-global--Color--200)' }}>Connecting…</span>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="ds-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {(() => {
            const t = contextMenu.torrent;
            const s = (t.state || '').toLowerCase();
            const isPaused = s.includes('paused') || s.includes('stopped');
            return (
              <>
                {isPaused
                  ? <div className="ds-ctx-item" onClick={() => { doResume([t.id]); setContextMenu(null); }}>▶ Resume</div>
                  : <div className="ds-ctx-item" onClick={() => { doPause([t.id]); setContextMenu(null); }}>⏸ Pause</div>
                }
                <div className="ds-ctx-sep" />
                <div className="ds-ctx-item" onClick={() => { doSetPriority(t.id, 'high'); setContextMenu(null); }}>↑ High Priority</div>
                <div className="ds-ctx-item" onClick={() => { doSetPriority(t.id, 'normal'); setContextMenu(null); }}>= Normal Priority</div>
                <div className="ds-ctx-item" onClick={() => { doSetPriority(t.id, 'low'); setContextMenu(null); }}>↓ Low Priority</div>
                <div className="ds-ctx-sep" />
                <div className="ds-ctx-item" onClick={() => { setFileModalTorrent(t); setContextMenu(null); }}>📄 File Priorities</div>
                <div className="ds-ctx-sep" />
                <div className="ds-ctx-item danger" onClick={() => { setDeleteFilesDefault(false); setDeleteTargets([t]); setContextMenu(null); }}>✕ Remove</div>
                <div className="ds-ctx-item danger" onClick={() => { setDeleteFilesDefault(true); setDeleteTargets([t]); setContextMenu(null); }}>✕ Remove + Delete Files</div>
              </>
            );
          })()}
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onAdded={fetchAll}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onAuthError={onAuthError}
        />
      )}

      {fileModalTorrent && (
        <FilePriorityModal
          torrent={fileModalTorrent}
          onClose={() => setFileModalTorrent(null)}
          onAuthError={onAuthError}
        />
      )}

      {deleteTargets && (
        <DeleteConfirmModal
          torrents={deleteTargets}
          defaultDeleteFiles={deleteFilesDefault}
          onConfirm={deleteFiles => doDelete(deleteTargets, deleteFiles)}
          onClose={() => { setDeleteTargets(null); setDeleteFilesDefault(false); }}
        />
      )}
    </div>
  );
}
