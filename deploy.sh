#!/usr/bin/env bash
# Deploy varco-gates on the Oracle server (jlide/DEV Oracle ARM)
# Usage: ./deploy.sh
set -euo pipefail

HOST="paraflu@jlide.duckdns.org"

export ADMIN_PASSWORD="${ADMIN_PASSWORD:?"ADMIN_PASSWORD env required"}"
export HA_TOKEN="${HA_TOKEN:?"HA_TOKEN env required"}"
export HA_BASE_URL="${HA_BASE_URL:-http://192.168.3.27:8123}"

echo ">> Deploying varco-gates on $HOST (pull from GHCR)"

ssh "$HOST" 'set -euo pipefail
cd ~/varco-gates
if [ ! -f docker-compose.yml ]; then
  git clone https://github.com/paraflu/varco-gates.git .
fi
docker compose pull
docker compose up -d --remove-orphans'

echo ">> Smoke test"
sleep 5
ssh "$HOST" 'curl -s -o /dev/null -w "http_code=%{http_code}\n" http://localhost:3099/' || true
echo ">> Done"
