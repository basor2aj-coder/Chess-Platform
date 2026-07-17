#!/bin/bash
# EC2 "User data" for a fresh Ubuntu 24.04 (arm64) instance. Cloud-init runs
# this once, as root, on first boot -- pasting it into the User data field at
# launch time reproduces the manual setup from the original deployment
# session: Node 20, Caddy, the app checked out and running under systemd.
#
# Not idempotent by design -- it's meant for a brand-new instance's first
# boot, not for re-running against an already-configured box. Check
# /var/log/cloud-init-output.log on the instance if something goes wrong.
set -euo pipefail

REPO_URL="https://github.com/basor2aj-coder/Chess-Platform.git"
APP_DIR="/opt/table-chess"
DOMAIN="chess.basorelabs.dev"

apt-get update -y
apt-get upgrade -y

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

# Caddy
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# App checkout
mkdir -p "$APP_DIR"
git clone -b main "$REPO_URL" "$APP_DIR"
chown -R ubuntu:ubuntu "$APP_DIR"
cd "$APP_DIR"
sudo -u ubuntu npm ci

# systemd service
cat > /etc/systemd/system/table-chess.service <<'UNIT'
[Unit]
Description=Table chess platform
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/table-chess
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
User=ubuntu

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now table-chess

# Caddy reverse proxy + automatic TLS
cat > /etc/caddy/Caddyfile <<CADDYFILE
$DOMAIN {
    reverse_proxy 127.0.0.1:3000
}
CADDYFILE

systemctl reload caddy || systemctl restart caddy

echo "Bootstrap complete"
