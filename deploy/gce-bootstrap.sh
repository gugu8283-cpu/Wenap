#!/usr/bin/env bash
# Wenap GCE 首次 bootstrap（Ubuntu 22.04）。以 root 或 sudo 运行。
set -euo pipefail

DATA_MOUNT="${DATA_MOUNT:-/mnt/wenap-data}"
APP_DIR="${APP_DIR:-/opt/wenap}"
REPO_URL="${REPO_URL:-https://github.com/gugu8283-cpu/Wenap.git}"

apt-get update
apt-get install -y ca-certificates curl git docker.io docker-compose-plugin

systemctl enable docker
systemctl start docker

mkdir -p "$DATA_MOUNT"
chown -R 1000:1000 "$DATA_MOUNT" || true

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR/stockai" 2>/dev/null || cd "$APP_DIR"

echo "Next steps:"
echo "  1. Copy .env to $APP_DIR/stockai/.env (or $APP_DIR/.env)"
echo "  2. npm install && npm install @google-cloud/vertexai"
echo "  3. docker compose -f deploy/docker-compose.gce.yml up -d --build"
echo "  4. Point Cloudflare A record to this VM external IP"
