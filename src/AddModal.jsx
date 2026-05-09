import React, { useState, useRef } from 'react';
import * as api from './api';

export default function AddModal({ onClose, onAdded }) {
  const [tab, setTab]           = useState('file');
  const [selectedFile, setFile] = useState(null);
  const [savePath, setSavePath] = useState('');
  const [magnet, setMagnet]     = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const fileRef = useRef();

  function handleFileDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer?.files[0] || e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.torrent')) { setError('Please select a .torrent file.'); return; }
    setFile(f); setError('');
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      if (tab === 'file') {
        if (!selectedFile) { setError('Please select a .torrent file.'); setLoading(false); return; }
        await api.addTorrentFile(selectedFile, savePath.trim() || undefined);
      } else {
        if (!magnet.trim()) { setError('Please enter a magnet link.'); setLoading(false); return; }
        if (!magnet.trim().startsWith('magnet:')) { setError('Invalid magnet link.'); setLoading(false); return; }
        await api.addMagnet(magnet.trim(), savePath.trim() || undefined);
      }
      onAdded();
      onClose();
    } catch (ex) {
      if (ex.status === 401) { onClose(); return; }
      setError(ex.message || 'Failed to add torrent.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ds-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ds-modal">
        <div className="ds-modal-header">
          <h2>Add Torrent</h2>
          <button className="ds-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ds-modal-tabs">
          <div className={`ds-modal-tab ${tab === 'file' ? 'active' : ''}`} onClick={() => setTab('file')}>Torrent File</div>
          <div className={`ds-modal-tab ${tab === 'magnet' ? 'active' : ''}`} onClick={() => setTab('magnet')}>Magnet Link</div>
        </div>

        <div className="ds-modal-body">
          {tab === 'file' ? (
            <>
              <div
                className={`ds-drop-zone${selectedFile ? '' : ''}`}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                onDrop={e => { e.currentTarget.classList.remove('drag-over'); handleFileDrop(e); }}
                onClick={() => fileRef.current.click()}
              >
                <div className="ds-drop-icon">📂</div>
                <div className="ds-drop-label">{selectedFile ? selectedFile.name : 'Drop .torrent file here or click to browse'}</div>
                <div className="ds-drop-sub">{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : '.torrent files only'}</div>
                <input ref={fileRef} type="file" accept=".torrent" style={{ display: 'none' }} onChange={handleFileDrop} />
              </div>
            </>
          ) : (
            <div className="ds-field" style={{ marginBottom: 14 }}>
              <label className="ds-label">Magnet Link</label>
              <input
                className="ds-input"
                type="text"
                placeholder="magnet:?xt=urn:btih:…"
                value={magnet}
                onChange={e => setMagnet(e.target.value)}
                autoFocus
              />
            </div>
          )}

          <div className="ds-field">
            <label className="ds-label">Save to (optional)</label>
            <input
              className="ds-input"
              type="text"
              placeholder="Default download directory"
              value={savePath}
              onChange={e => setSavePath(e.target.value)}
            />
          </div>

          {error && <div className="ds-error">{error}</div>}
        </div>

        <div className="ds-modal-footer">
          <button className="ds-btn" onClick={onClose}>Cancel</button>
          <button className="ds-btn primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
