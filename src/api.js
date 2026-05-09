import cockpit from 'cockpit';

const SESSION_KEY = 'ds-session';
const PORT_KEY    = 'ds-port';

export function getPort() { return parseInt(localStorage.getItem(PORT_KEY) || '8080'); }
export function setPort(p) { localStorage.setItem(PORT_KEY, String(p)); resetHttp(); }

let _http = null;

function http() {
  if (!_http) _http = cockpit.http({ port: getPort(), address: '127.0.0.1' });
  return _http;
}

export function resetHttp() {
  if (_http) { try { _http.close(); } catch {} _http = null; }
}

function session() { return localStorage.getItem(SESSION_KEY); }

function authHeaders() {
  const s = session();
  return s ? { Cookie: s } : {};
}

async function req(method, path, body, extraHeaders = {}) {
  const opts = { method, path, headers: { ...authHeaders(), ...extraHeaders } };
  if (body !== undefined) opts.body = body;

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

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const r = http().request({
    method: 'POST',
    path: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  let cookie = null;
  r.response((status, headers) => {
    const raw = headers['set-cookie'];
    if (raw) {
      const val = Array.isArray(raw) ? raw[0] : raw;
      cookie = val.split(';')[0].trim();
    }
  });

  const data = JSON.parse(await r);
  if (!data.ok) throw new Error(data.error || 'Login failed');
  if (cookie) localStorage.setItem(SESSION_KEY, cookie);
  return data;
}

export function logout() {
  try { req('POST', '/api/auth/logout'); } catch {}
  localStorage.removeItem(SESSION_KEY);
  resetHttp();
}

export function isAuthenticated() { return !!session(); }

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
  const boundary = '----DSBoundary' + Math.random().toString(36).slice(2, 10);
  const CRLF = '\r\n';
  const enc  = new TextEncoder();

  const pre = enc.encode(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${file.name}"${CRLF}` +
    `Content-Type: application/octet-stream${CRLF}${CRLF}`
  );
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  let postStr = CRLF;
  if (savePath) {
    postStr += `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="save_path"${CRLF}${CRLF}` +
      `${savePath}${CRLF}`;
  }
  postStr += `--${boundary}--${CRLF}`;
  const post = enc.encode(postStr);

  const body = new Uint8Array(pre.length + fileBytes.length + post.length);
  body.set(pre, 0);
  body.set(fileBytes, pre.length);
  body.set(post, pre.length + fileBytes.length);

  let status = 200;
  const r = http().request({
    method: 'POST', path: '/api/torrents',
    headers: { ...authHeaders(), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: body.buffer,
  });
  r.response(s => { status = s; });
  const raw = await r;

  if (status === 401) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
  if (status >= 400) {
    let msg = `HTTP ${status}`;
    try { msg = JSON.parse(raw).error || msg; } catch {}
    throw new Error(msg);
  }
  return JSON.parse(raw);
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
