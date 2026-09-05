#!/usr/bin/env bash
# Deploy varco-gates on Oracle (jlide): pull GHCR image built by GitHub Actions
# Usage: ./deploy.sh
set -euo pipefail

# Check required environment variables
if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "Error: ADMIN_PASSWORD environment variable is required"
    exit 1
fi
if [ -z "${HA_TOKEN:-}" ]; then
    echo "Error: HA_TOKEN environment variable is required"
    exit 1
fi

HOST="paraflu@jlide.duckdns.org"
HA_BASE_URL="${HA_BASE_URL:-http://192.168.3.27:8123}"

echo ">> Pull + restart on $HOST"
ssh "$HOST" << EOF
set -e
export ADMIN_PASSWORD="$ADMIN_PASSWORD"
export HA_TOKEN="$HA_TOKEN"
export HA_BASE_URL="$HA_BASE_URL"
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
docker compose pull
docker compose up -d
EOF

echo ">> Smoke test"
sleep 8
ssh "$HOST" 'curl -s -o /dev/null -w "local http_code=%{http_code}\n" http://localhost:3099/' || true
echo ">> Done"