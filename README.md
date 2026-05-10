# cockpit-download-superstation

A [Cockpit](https://cockpit-project.org/) plugin for [Download Superstation](https://github.com/dl-romero/download-superstation) — a self-hosted torrent manager backed by libtorrent.

When installed, a **Download Superstation** item appears in Cockpit's navigation menu, giving you full torrent management without opening a separate browser tab. No login prompt — Cockpit's own authentication gates access.

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
- Auto-detects the service port — no manual configuration needed

---

## Requirements

- [Cockpit](https://cockpit-project.org/) installed and running on the server (`cockpit` package)
- [Download Superstation](https://github.com/dl-romero/download-superstation) **v1.3.0 or later** running on the same host
- Node.js ≥ 16 (only for the one-time build step)

> **Container users:** the Podman/Docker systemd unit must include the `COCKPIT_AUTH_PATH` volume and env var described below. These are included in the templates shipped with Download Superstation v1.3.0.

---

## Install

### Quick install (recommended)

```bash
git clone https://github.com/dl-romero/cockpit-download-superstation.git
cd cockpit-download-superstation

# Per-user install (no root required) — recommended for Podman rootless setups
bash install.sh --user

# System-wide install (requires root) — use with Docker system service
sudo bash install.sh
```

The script installs Node.js dependencies, builds the plugin, and copies the output to the correct Cockpit package path.

| Install type | Cockpit package path |
|---|---|
| Per-user (`--user`) | `~/.local/share/cockpit/cockpit-download-superstation/` |
| System-wide | `/usr/share/cockpit/cockpit-download-superstation/` |

After installing, refresh Cockpit in your browser — no service restart needed.

### Manual install

```bash
git clone https://github.com/dl-romero/cockpit-download-superstation.git
cd cockpit-download-superstation
npm ci
npm run build

# Per-user (no root)
mkdir -p ~/.local/share/cockpit/cockpit-download-superstation
cp -r dist/. manifest.json ~/.local/share/cockpit/cockpit-download-superstation/

# System-wide
sudo mkdir -p /usr/share/cockpit/cockpit-download-superstation
sudo cp -r dist/. manifest.json /usr/share/cockpit/cockpit-download-superstation/
```

---

## Backend Setup by Install Type

The plugin communicates with the Download Superstation service over `cockpit.http()` (proxied through `cockpit-bridge` — no firewall ports required). Authentication is handled automatically via a bearer token written by the service at startup.

### Bare-metal install

No extra configuration needed. `cockpit-bridge` connects to the service from `127.0.0.1`, which the service trusts natively. The key file at `~/.download-superstation/cockpit-api-key` is written automatically on first run.

The plugin reads that file to auto-detect the port and bearer token. If the file is absent, set the port manually in **Settings → Service Port**.

### Podman rootless container (recommended container setup)

The Podman systemd unit must mount `~/.download-superstation` into the container as a shared volume and pass two environment variables so the service writes its auth key to a host-readable location.

The unit shipped with Download Superstation v1.3.0 includes this already. If you installed an earlier version, add these three lines to your `ExecStart`:

```ini
ExecStart=/usr/bin/podman run --rm --userns=keep-id \
    ...
    -v %h/.download-superstation:/cockpit-auth:z \
    -e COCKPIT_AUTH_PATH=/cockpit-auth \
    -e COCKPIT_PORT=8080 \
    ...
```

`COCKPIT_PORT` must match the **host-side** port in your `-p` mapping (the left number). If you map `-p 5005:8080`, set `-e COCKPIT_PORT=5005`.

After updating the unit:

```bash
systemctl --user daemon-reload
systemctl --user restart download-superstation
```

### Docker system service

The Docker systemd unit must mount a directory owned by the Cockpit admin user and pass the same env vars. Replace `/home/admin` with the home directory of the user who logs into Cockpit:

```ini
ExecStart=/usr/bin/docker run --rm \
    ...
    -v /home/admin/.download-superstation:/cockpit-auth \
    -e COCKPIT_AUTH_PATH=/cockpit-auth \
    -e COCKPIT_PORT=8080 \
    ...
```

After updating the unit:

```bash
sudo systemctl daemon-reload
sudo systemctl restart download-superstation
```

### Docker Compose

Add the volume and environment variables to your `docker-compose.yml`:

```yaml
services:
  download-superstation:
    image: ghcr.io/dl-romero/download-superstation:latest
    ports:
      - "8080:8080"
      - "6881:6881/tcp"
      - "6881:6881/udp"
    volumes:
      - ./downloads:/downloads
      - ./data:/data
      - /home/admin/.download-superstation:/cockpit-auth   # replace admin with your user
    environment:
      DOWNLOAD_PATH: /downloads
      DATA_PATH: /data
      PORT: "8080"
      COCKPIT_PORT: "8080"
      COCKPIT_AUTH_PATH: /cockpit-auth
    restart: unless-stopped
```

---

## Environment Variables (backend)

These are passed to the Download Superstation service (container or bare-metal), not to the plugin itself.

| Variable | Default | Description |
|---|---|---|
| `COCKPIT_PORT` | same as `PORT` | Host-side port that `cockpit.http()` connects to. Set when the container's internal port differs from the mapped host port (e.g. `-p 5005:8080` → set `COCKPIT_PORT=5005`). |
| `COCKPIT_AUTH_PATH` | same as `DATA_PATH` | Directory where the Cockpit bearer-token key file (`cockpit-api-key`) is written. Mount a host-readable volume here for container installs. |

---

## How it works

- The plugin is a standard Cockpit package served by the Cockpit web server.
- The UI is built with React 18 and PatternFly 5 (loaded from Cockpit's own `../base1/patternfly.css` — no extra downloads).
- All API calls use `cockpit.http()`, which routes through `cockpit-bridge` on the server as plain HTTP to `127.0.0.1:<port>`. The browser never makes direct requests to the backend — no CORS configuration needed.
- On startup, the plugin reads `cockpit-api-key` via `cockpit.spawn(['cat', path])` to auto-detect the service port and bearer token. This file is written by the service at startup.
- Every API request includes an `Authorization: Bearer <token>` header. The service validates the token and returns `401` if it doesn't match. If no token is available, bare-metal installs fall back to loopback-address trust.
- The service status banner uses `cockpit.spawn(['systemctl', '--user', 'show', ...])` to detect and display the running state of the `download-superstation` or `torrent-webui` service unit, and polls every 5 seconds.
- A known quirk in Cockpit's `http-stream2` bridge channel: the bridge reads the full request body before opening the TCP connection, and only starts connecting when it receives the channel EOF. The plugin explicitly sets `body: ''` on all body-less requests (GET, DELETE) so the EOF is always sent.

---

## Updating

```bash
cd cockpit-download-superstation
git pull
bash install.sh --user   # or: sudo bash install.sh
```

---

## Uninstall

```bash
# Per-user
rm -rf ~/.local/share/cockpit/cockpit-download-superstation

# System-wide
sudo rm -rf /usr/share/cockpit/cockpit-download-superstation
```

---

## Development

```bash
npm ci
npm run watch   # rebuilds on every file change
```

Copy `dist/` to the Cockpit package path after each build, or symlink it:

```bash
ln -s "$(pwd)/dist" ~/.local/share/cockpit/cockpit-download-superstation
cp manifest.json ~/.local/share/cockpit/cockpit-download-superstation/
```

---

## License

MIT
