#!/usr/bin/env bash
# Deploy varco-gates on Oracle (jlide): pull GHCR image built by GitHub Actions
# Usage: ./deploy.sh
set -euo pipefail

HOST="paraflu@jlide.duckdns.org"

echo ">> Pull + restart on $HOST"
ssh "$HOST" 'set -e
if [ -d ~/varco-gates ] && [ -d ~/varco-gates/.git ]; then
    echo "Updating existing repo"
    cd ~/varco-gates
    git fetch origin && git checkout main && git pull --ff-only
else
    echo "Cloning repo"
    rm -rf ~/varco-gates
    git clone https://github.com/paraflu/varco-gates.git ~/varco-gates
    cd ~/varco-gates
fi
export ADMIN_PASSWORD="${ADMIN_PASSWORD:?\"ADMIN_PASSWORD env required\"}"
export HA_TOKEN="${HA_TOKEN:?\"HA_TOKEN env required\"}"
export HA_BASE_URL="${HA_BASE_URL:-http://192.168.3.27:8123}"
docker compose pull
docker compose up -d'
echo ">> Smoke test"
sleep 8
ssh "$HOST" 'curl -s -o /dev/null -w \"local http_code=%{http_code}\\n\" http://localhost:3099/' || true
echo ">> Done"