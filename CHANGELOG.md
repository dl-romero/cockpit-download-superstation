# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] — 2026-05-09

### Added

- Full Cockpit package for Download Superstation — appears in Cockpit's navigation menu with no login prompt.
- `src/App.jsx` — top-level auth state machine; reads `cockpit-api-key` on load and goes straight to the torrent manager without requiring a separate sign-in.
- `src/TorrentManager.jsx` — main page:
  - Sidebar with live per-category counts (All, Downloading, Seeding, Finished, Paused, Error).
  - Sortable table: name, priority, size, state, progress, download/upload speed, ratio, ETA.
  - Single-select (click) and multi-select (Ctrl/Cmd+click); toolbar buttons disable when irrelevant.
  - Right-click context menu: resume/pause, priority (high/normal/low), file priorities, remove.
  - Side detail panel — General, Peers, and Trackers tabs with live 2-second updates.
  - File priority modal with per-file dropdowns and bulk-set buttons (All High/Normal/Low, Skip All).
  - Delete confirmation modal with optional "also delete files" checkbox.
  - Status bar: aggregate download/upload speed, torrent count, free disk space.
  - Polling pauses automatically when the Cockpit tab is hidden.
- `src/ServiceStatus.jsx` — real-time systemd service banner:
  - Detects both `download-superstation` and `torrent-webui` service names automatically.
  - Shows running/stopped/unknown state with a colour-coded dot.
  - One-click Start/Stop via `cockpit.spawn(['systemctl', '--user', ...])`.
  - Polls every 5 seconds.
- `src/AddModal.jsx` — add-torrent modal with Torrent File (drag-and-drop) and Magnet Link tabs; optional per-torrent save path.
- `src/SettingsModal.jsx` — settings modal covering storage, speed limits, active torrent caps, seeding limits, password change, and service port.
- `src/api.js` — all API calls via `cockpit.http()` (bridge-proxied to `127.0.0.1:<port>`):
  - Reads `cockpit-api-key` via `cockpit.spawn(['cat', path])` to auto-detect the service port and bearer token on startup.
  - Sends `Authorization: Bearer <token>` on every request.
  - Always sets `body: body ?? ''` on requests so `cockpit-bridge` receives the channel EOF it needs before opening the TCP connection.
- `src/app.css` — custom CSS using PatternFly 5 CSS variables for full dark/light theme support.
- `build.js` — esbuild build script; `cockpit` marked external (resolved via importmap at runtime).
- `install.sh` — installs the built plugin to the Cockpit package path; `--user` flag for per-user install (no root), default is system-wide.
- `manifest.json` — Cockpit package descriptor registering the plugin in the nav menu.

### Fixed

- `cockpit-bridge` hangs on body-less requests (`GET`, `DELETE`): the bridge reads the full request body before connecting, and only sends the TCP connection when it receives channel EOF. The JS client only sends EOF when `opts.body` is defined. Fixed by always setting `body: body ?? ''`.
- `cockpit.file().read()` hangs on files with a private SELinux MCS label (`container_file_t:s0:c…`): replaced with `cockpit.spawn(['cat', path])` which works regardless of label.
- Service status showed incorrect state when using system D-Bus, which cannot see user-level systemd units: replaced D-Bus with `cockpit.spawn(['systemctl', '--user', 'show', ...])`.
- Passing `{ port, address }` to `cockpit.http()` added an `address` capability flag that caused silent failures in Cockpit 344: changed to `cockpit.http(port)` (port number only).
