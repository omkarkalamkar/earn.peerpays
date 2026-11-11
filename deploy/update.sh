#!/usr/bin/env bash
# Build & (re)deploy the app. Run from the repo root on the server:
#   cd /var/www/peerpays && bash deploy/update.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Pulling latest (skips if not a git repo)"
git pull --ff-only || echo "(not a git repo or nothing to pull - continuing)"

echo "==> Backend deps (production only)"
cd "$APP_DIR/backend"
npm ci --omit=dev

echo "==> Frontend build"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Restarting API service"
sudo systemctl restart peerpays-api

echo "==> Reloading nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "Deploy complete. Check: sudo systemctl status peerpays-api --no-pager"
