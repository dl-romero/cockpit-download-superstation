# cockpit-download-superstation

A [Cockpit](https://cockpit-project.org/) plugin for [Download Superstation](https://github.com/dl-romero/download-superstation) — a self-hosted torrent manager backed by libtorrent.

When installed, a **Download Superstation** item appears in Cockpit's navigation menu, giving you full torrent management without opening a separate browser tab.

---

## Features

- Add torrents via `.torrent` file (drag & drop) or magnet link
- Per-torrent priority — High, Normal, Low
- Per-file priority within a torrent — skip individual files
- Pause, resume, and remove torrents (with optional file deletion)
- Live detail panel — General info, Peers, and Trackers tabs
- Live progress bars, speeds, ETA, and share ratio
- Sidebar categories: All, Downloading, Seeding, Finished, Paused, Error
- Sortable table columns and right-click context menu
- Real-time service status banner with one-click Start/Stop
- Settings — download path, speed limits, active torrent caps, seeding limits, password change

---

## Requirements

- [Cockpit](https://cockpit-project.org/) installed and running on the server
- [Download Superstation](https://github.com/dl-romero/download-superstation) service running on the same host
- Node.js (for the one-time build step)

---

## Install

### Quick install (recommended)

```bash
git clone https://github.com/dl-romero/cockpit-download-superstation.git
cd cockpit-download-superstation

# System-wide (requires root)
sudo bash install.sh

# Per-user (no root required)
bash install.sh --user
```

The script installs Node.js dependencies, builds the plugin, and copies the output to the correct Cockpit package path:

| Install type | Path |
|---|---|
| System-wide | `/usr/share/cockpit/cockpit-download-superstation/` |
| Per-user | `~/.local/share/cockpit/cockpit-download-superstation/` |

After installing, refresh Cockpit in your browser — no service restart needed.

### Manual install

```bash
git clone https://github.com/dl-romero/cockpit-download-superstation.git
cd cockpit-download-superstation
npm ci
npm run build

# System-wide
sudo mkdir -p /usr/share/cockpit/cockpit-download-superstation
sudo cp -r dist/. /usr/share/cockpit/cockpit-download-superstation/

# Per-user
mkdir -p ~/.local/share/cockpit/cockpit-download-superstation
cp -r dist/. ~/.local/share/cockpit/cockpit-download-superstation/
```

### Build for development

```bash
npm ci
npm run watch   # rebuilds on file change
```

---

## Configuration

The plugin connects to Download Superstation on `127.0.0.1:8080` by default. If your service runs on a different port, change it in the **Settings → Cockpit Plugin → Service Port** field after signing in.

The port setting is stored in the browser's `localStorage` per Cockpit origin and does not affect the Download Superstation service itself.

---

## How it works

- The plugin is a standard Cockpit package served directly by the Cockpit web server.
- UI is built with React 18 and PatternFly 5 (linked from Cockpit's own `../base1/patternfly.css` — no extra download).
- API calls use `cockpit.http()` (bridge-proxied HTTP to `127.0.0.1:<port>`) — the browser never makes direct requests to the backend, so no CORS configuration is required.
- Session cookie authentication is handled transparently: the plugin logs in once and stores the session in `localStorage`, injecting the `Cookie` header on every subsequent request.
- The service status banner uses `cockpit.dbus()` to read systemd state in real time and provides one-click Start/Stop via `superuser: 'require'` escalation.
- The plugin auto-discovers whichever service name is in use: `download-superstation` (Docker/Podman installs) or `torrent-webui` (legacy bare-metal installs).
- If neither service unit file exists on the host, Cockpit will not show the plugin in the menu.

---

## Updating

```bash
cd cockpit-download-superstation
git pull
sudo bash install.sh        # system-wide
# or
bash install.sh --user      # per-user
```

---

## Uninstall

```bash
# System-wide
sudo rm -rf /usr/share/cockpit/cockpit-download-superstation

# Per-user
rm -rf ~/.local/share/cockpit/cockpit-download-superstation
```

---

## License

MIT
