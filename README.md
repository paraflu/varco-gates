# varco-gates

Token-based web app to open/close the home gates via Home Assistant toggles. Vue 3 + Bootstrap frontend, Express + SQLite backend. Deployed via Docker on Oracle ARM, exposed through Nginx Proxy Manager.

![flow](https://img.shields.io/badge/stack-Vue%203%20%2B%20Express-blue)

## How it works

1. **Admin** logging in with a password generates a time-limited token (`/admin`)
2. The token becomes a URL: `https://gates.paraflu.duckdns.org/<token>`
3. Anyone with that URL can open/close both gates **until the token expires**.
4. Expired/revoked tokens get a 403.

## Gates

| Gate | Entity (HA) |
|------|------------------|
| Cancello Andrea | `switch.sonoff_1002658c25_1` |
| Cancello Alessandro | `switch.sonoff_1002592ef9_1` |

## Local dev

```bash
npm install
ADMIN_PASSWORD=dev PORT=3000 node server/index.js   # backend on :3000
npm run dev                                        # vite on :5173 (proxy /api)
```

## Docker (Oracle)

```bash
cp .env.example .env        # edit: ADMIN_PASSWORD, HA_TOKEN
docker compose up -d       # container on 127.0.0.1:3099
```

NPM on the server proxies `gates.paraflu.duckdns.org` → `http://127.0.0.1:3099`.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/tokens` | Bearer ADMIN_PASSWORD | Create token `{label, ttl_seconds}` |
| GET | `/api/admin/tokens` | Bearer | List tokens |
| DELETE | `/api/admin/tokens/:id` | Bearer | Revoke |
| GET | `/api/verify/:token` | — | Validate + list gates |
| POST | `/api/control` | token in body | `{token, gate, action: open|close}` |

## CI/CD

Push to `main` → GitHub Actions **builda l'immagine Docker (linux/arm64 + linux/amd64)** e la pusherà su `ghcr.io/paraflu/varco-gates`, poi SSH-deploya su Oracle `jlide.duckdns.org`: `git pull` + `docker compose pull` + `up -d`. Secrets da impostare in repo settings → Secrets and variables → Actions:
- `ORACLE_SSH_KEY` — private key SSH di accesso a `paraflu@jlide.duckdns.org`
- `ADMIN_PASSWORD` — password admin UI
- `HA_TOKEN` — long-lived token Home Assistant
- `HA_BASE_URL` — es. `http://192.168.3.27:8123`

## Notes
- HA is on Tailscale only → the Oracle server must reach `192.168.3.27:8123` (either via Tailscale subnet route or via a tunnel from the homelab).
- Long-lived HA token: `ha.forlin.duckdns.org/profile` → security → long-lived access token.


