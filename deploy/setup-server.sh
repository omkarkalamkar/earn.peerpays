#!/usr/bin/env bash
# One-time server bootstrap for Ubuntu 22.04/24.04 (run as the 'ubuntu' user).
# Installs Node.js 20, nginx, git and certbot. Safe to re-run.
set -euo pipefail

echo "==> Updating apt"
sudo apt-get update -y

echo "==> Installing Node.js 20 (NodeSource)"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v && npm -v

echo "==> Installing nginx, git, certbot"
sudo apt-get install -y nginx git
sudo apt-get install -y certbot python3-certbot-nginx

echo "==> Creating app directory /var/www/peerpays"
sudo mkdir -p /var/www/peerpays
sudo chown -R "$USER":"$USER" /var/www/peerpays

echo "==> Enabling nginx"
sudo systemctl enable --now nginx

echo "Done. Next: put the code in /var/www/peerpays, configure backend/.env, then run deploy/update.sh"
