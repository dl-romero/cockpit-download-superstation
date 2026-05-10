const cockpit = window.cockpit;

const PORT_KEY = 'ds-port';

export function getPort() { return parseInt(localStorage.getItem(PORT_KEY) || '8080'); }
export function setPort(p) { localStorage.setItem(PORT_KEY, String(p)); resetHttp(); }

let _http = null;
let _apiKey = null;

function http() {
  if (!_http) _http = cockpit.http(getPort());
  return _http;
}

export function resetHttp() {
  if (_http) { try { _http.close(); } catch {} _http = null; }
}

function authHeaders() {
  return _apiKey ? { 'Authorization': `Bearer ${_apiKey}` } : {};
}

// cockpit.file().read() can hang on SELinux-relabeled container files.
// cockpit.spawn(['cat', path]) goes through the same bridge auth but uses a
// process channel that is not affected by the same stall, so we use it here.
async function readKeyFile(path) {
  return cockpit.spawn(['cat', path], { err: 'ignore' });
}

// Reads the key file written by the service at startup to get the port and
// bearer token. Tries the bare-metal/shared-mount path first (~/.download-
// superstation/), then the legacy container data-volume path as a fallback.
export async function initAuth() {
  try {
    const user = await cockpit.user();
    const paths = [
      `${user.home}/.download-superstation/cockpit-api-key`,
      `${user.home}/download-superstation/data/cockpit-api-key`,
    ];
    for (const path of paths) {
      try {
        const raw = await readKeyFile(path);
        if (raw) {
          const cfg = JSON.parse(raw);
          if (cfg.port) setPort(cfg.port);
          if (cfg.key)  _apiKey = cfg.key;
          break;
        }
      } catch {
        // File missing or unreadable — try next path.
      }
    }
  } catch {
    // cockpit.user() failed — proceed with stored port and no bearer token.
  }
}

async function req(method, path, body, extraHeaders = {}) {
  // cockpit-bridge reads the entire request body before connecting, and only
  // starts the connection when the JS client sends channel EOF. The JS client
  // only sends EOF when opts.body is defined (even ''), so we always set it.
  const opts = { method, path, headers: { ...authHeaders(), ...extraHeaders }, body: body ?? '' };

  let status = 200;
  const r = http().request(opts);
  r.response(s => { status = s; });

  const raw = await r;

  if (status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
  if (status < 200 || status >= 300) {
    let msg = `HTTP ${status}`;
    try { msg = JSON.parse(raw).error || msg; } catch {}
    const e = new Error(msg); e.status = status; throw e;
  }
  try { return JSON.parse(raw); } catch { return raw; }
}

// ── Torrents ───────────────────────────────────────────────────────────────

export const getTorrents    = ()       => req('GET',    '/api/torrents');
export const getStats       = ()       => req('GET',    '/api/stats');
export const pauseTorrent   = id       => req('POST',   `/api/torrents/${id}/pause`);
export const resumeTorrent  = id       => req('POST',   `/api/torrents/${id}/resume`);
export const removeTorrent  = (id, del) => req('DELETE', `/api/torrents/${id}?delete_files=${!!del}`);
export const getTorrentDetail = id     => req('GET',    `/api/torrents/${id}/detail`);
export const getTorrentFiles  = id     => req('GET',    `/api/torrents/${id}/files`);

export const setPriority = (id, priority) =>
  req('POST', `/api/torrents/${id}/priority`,
    JSON.stringify({ priority }), { 'Content-Type': 'application/json' });

export const setFilePriorities = (id, priorities) =>
  req('POST', `/api/torrents/${id}/files`,
    JSON.stringify({ priorities }), { 'Content-Type': 'application/json' });

export const addMagnet = (magnet, savePath) =>
  req('POST', '/api/torrents',
    JSON.stringify({ magnet, save_path: savePath || undefined }),
    { 'Content-Type': 'application/json' });

export async function addTorrentFile(file, savePath) {
  // cockpit.http() cannot send raw binary bodies without corruption, so we
  // base64-encode the .torrent file and send it as JSON instead.
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const file_b64 = btoa(binary);
  return req('POST', '/api/torrents',
    JSON.stringify({ file_b64, filename: file.name, save_path: savePath || undefined }),
    { 'Content-Type': 'application/json' });
}

// ── Settings ───────────────────────────────────────────────────────────────

export const getSettings    = ()     => req('GET',  '/api/settings');
export const updateSettings = data   => req('POST', '/api/settings', JSON.stringify(data), { 'Content-Type': 'application/json' });
export const getVersion     = ()     => req('GET',  '/api/version');
export const triggerUpdate  = ()     => req('POST', '/api/update');

export const changePassword = (currentPassword, newPassword, username) =>
  req('POST', '/api/auth/change-password',
    JSON.stringify({ current_password: currentPassword, new_password: newPassword, username }),
    { 'Content-Type': 'application/json' });
