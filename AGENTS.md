# AGENTS.md — varco-gates

## Project
Token-gated control of two home gates (Andrea, Alessandro) via Home Assistant switches. Frontend Vue 3 + Tailwind CSS v4 (SPA, dark glassmorphism UI), backend Express + better-sqlite3, Docker Compose deploy on Oracle ARM `jlide` (paraflu@jlide.duckdns.org), exposed via NPM at `gates.paraflu.duckdns.org`.

## Architecture

```
Browser ── HTTPS ── NPM (Oracle) ── 127.0.0.1:3099 ── Docker (node)
                                          │
                                          ├─ /admin → session cookie HMAC (crea token SQLite)
                                          ├─ /<token> → verify+control UI
                                          └─ /api/control → HA REST (whitelist: toggle|turn_on|turn_off)
```

## Key files
- `server/index.js` — Express routes (login/logout sessione cookie, admin CRUD token, audit, verify, control)
- `server/db.js` — better-sqlite3 storage (token + scadenza + revoked + audit_log)
- `server/ha.js` — gate entity mapping + HA REST client
- `server/notify.js` — alert SMTP (login falliti)
- `src/views/GateControl.vue` — public token UI (Apri/Chiudi)
- `src/views/AdminPanel.vue` — password-protected admin UI (token + audit viewer)
- `docker-compose.yml` — prod compose (env via .env, volume varco_data)
- `deploy.sh` — manual deploy helper (richiede ADMIN_PASSWORD, HA_TOKEN, COOKIE_SECRET)
- `.github/workflows/deploy.yml` — CI: build immagine (arm64+amd64) → push GHCR → SSH su Oracle → curl compose + docker compose pull + up

## Entities HA (verified 2026-09-02)
- `switch.sonoff_1002658c25_1` = Cancello Andrea (`turn_on` apri, `turn_off` chiudi)
- `switch.sonoff_1002592ef9_1` = Cancello Alessandro

## Env vars
| Var | Required | Notes |
|-----|----------|-------|
| `ADMIN_PASSWORD` | yes | Admin UI password (never commit real one`) |
| `COOKIE_SECRET` | yes | HMAC secret for session cookie, `openssl rand -hex 32`. Fallback: ADMIN_PASSWORD (con warning log) |
| `HA_BASE_URL` | yes | default `http://192.168.3.27:8123` |
| `HA_TOKEN` | yes | Long-lived HA token |
| `SMTP_HOST` | no | alert email on failed logins (no host = alerts only logged) |
| `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `ALERT_FROM` / `ALERT_TO` | no | SMTP config |
| `GATE_ANDREA_ENTITY` | no | override entity |
| `GATE_ALESSANDRO_ENTITY` | no | override entity |
| `PORT` | no | default 3000 |

## Security model
- Admin session: cookie `vg_session` = `expiresAt.nonce.HMAC` (httpOnly, secure, sameSite=strict, 8h), verificato con `timingSafeEqual`.
- CSRF: middleware globale — POST/DELETE senza header `X-Requested-With: XMLHttpRequest` → 403.
- Login rate limit: 10 fail/15min per IP → 429 (in-memory Map).
- `/api/control`: action whitelist `toggle|turn_on|turn_off`; gate da lista statica (no free-text).
- Audit log SQLite: login, token create/revoke/reveal, gate control, csrf_block — tutti con IP e timestamp; view in admin UI.

## GitHub Actions secrets (repo → Settings → Secrets)
| Secret | Usato per |
|--------|-----------|
| `ORACLE_SSH_KEY` | ssh/scp verso `paraflu@jlide.duckdns.org` |
| `ADMIN_PASSWORD` | export → container |
| `COOKIE_SECRET` | export → container (session HMAC) |
| `HA_TOKEN` | export → container |
| `HA_BASE_URL` | export → container |

Il workflow **builda l'immagine su GitHub Actions** (multi-arch arm64/amd64) e la pusherà su GHCR; poi su Oracle fa `git pull` + `docker compose pull` + `up -d` (env esportate dalle GitHub secrets — niente .env file sul server). Il package GHCR è pubblico (eredita dal repo public).

## Operations
- **Regenerate tokens** → admin UI `/admin`
- **Add/remove gates** → `server/ha.js` (mapping) + frontend auto-lists from `/api/verify`
- **Deploy** → push main (CI), or `./deploy.sh` manually
- **Logs** → `docker compose -f ~/varco-gates/docker-compose.yml logs -f varco-gates`
- **Backup** → `docker run --rm -v varco-gates_varco_data:/data -v $PWD:/backup alpine tar czf /backup/varco-data-$(date +%F).tar.gz -C /data .`

## Constraints
- NEVER commit real `ADMIN_PASSWORD`/`HA_TOKEN`/`COOKIE_SECRET` (use .env)
- HA is NOT public: only Tailscale/LAN reachable → deploy host must reach `192.168.3.27:8123` (check `curl http://192.168.3.27:8123/api/` with auth from Oracle`)
- Token min TTL 60s, max 1y.

