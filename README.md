# varco-gates

Token-based web app to open/close the home gates via Home Assistant toggles. Vue 3 + Tailwind CSS v4 frontend, Express + better-sqlite3 backend. Deployed via Docker on Oracle ARM, exposed through Nginx Proxy Manager.

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
cp .env.example .env        # edit: ADMIN_PASSWORD, COOKIE_SECRET (openssl rand -hex 32), HA_TOKEN
docker compose up -d       # container on 127.0.0.1:3099
```

NPM on the server proxies `gates.paraflu.duckdns.org` → `http://127.0.0.1:3099`.

## Security

- **Admin session**: cookie `vg_session` HMAC-signed (`httpOnly`, `secure`, `sameSite=strict`), 8h validity. Signed with `COOKIE_SECRET` (dedicated, not the admin password).
- **CSRF**: all state-changing endpoints require `X-Requested-With: XMLHttpRequest` header (impossible to forge cross-origin).
- **Login rate limit**: 10 failed attempts / 15 min per IP → 429.
- **Action whitelist**: `/api/control` accepts only `toggle | turn_on | turn_off` (prevents path traversal to arbitrary HA endpoints).
- **Password comparison**: constant-time (`timingSafeEqual` on SHA-256 digests).
- **Audit log**: every login/token/gate event is logged to SQLite (`audit_log` table) with IP + result; SMTP alert after ≥5 failed logins in 5 min. Visible in admin UI, filterable.

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/login` | — | `{password}` → sets session cookie |
| POST | `/api/admin/logout` | cookie | Clears session |
| POST | `/api/admin/tokens` | cookie | Create token `{label, ttl_seconds}` |
| GET | `/api/admin/tokens` | cookie | List tokens (prefix only) |
| GET | `/api/admin/tokens/:id` | cookie | Reveal full token + URL (audit-logged) |
| DELETE | `/api/admin/tokens/:id` | cookie | Revoke |
| GET | `/api/admin/audit` | cookie | Audit log `{limit, kind, since_minutes}` |
| GET | `/api/verify/:token` | — | Validate + list gates |
| POST | `/api/control` | token in body | `{token, gate, action: toggle|turn_on|turn_off}` |

## CI/CD

Push to `main` → GitHub Actions **builda l'immagine Docker (linux/arm64 + linux/amd64)** e la pusherà su `ghcr.io/paraflu/varco-gates`, poi SSH-deploya su Oracle `jlide.duckdns.org`: scarica `docker-compose.yml` dal repo + `docker compose pull` + `up -d`. Secrets da impostare in repo settings → Secrets and variables → Actions:
- `ORACLE_SSH_KEY` — private key SSH di accesso a `paraflu@jlide.duckdns.org`
- `ADMIN_PASSWORD` — password admin UI
- `COOKIE_SECRET` — segreto HMAC cookie sessione (`openssl rand -hex 32`)
- `HA_TOKEN` — long-lived token Home Assistant
- `HA_BASE_URL` — es. `http://192.168.3.27:8123`

## Notes
- HA is on Tailscale only → the Oracle server must reach `192.168.3.27:8123` (either via Tailscale subnet route or via a tunnel from the homelab).
- Long-lived HA token: `ha.forlin.duckdns.org/profile` → security → long-lived access token.


