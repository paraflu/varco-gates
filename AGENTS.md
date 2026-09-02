# AGENTS.md — varco-gates

## Project
Token-gated control of two home gates (Andrea, Alessandro) via Home Assistant switches. Frontend Vue 3 + Bootstrap 5 (SPA), backend Express + better-sqlite3, Docker Compose deploy on Oracle ARM `jlide` (paraflu@jlide.duckdns.org), exposed via NPM at `gates.paraflu.duckdns.org`.

## Architecture

```
Browser ── HTTPS ── NPM (Oracle) ── 127.0.0.1:3099 ── Docker (node)
                                          │
                                          ├─ /admin → Bearer ADMIN_PASSWORD (crea token SQLite)
                                          ├─ /<token> → verify+control UI
                                          └─ /api/control → HA REST (turn_on/turn_off)
```

## Key files
- `server/index.js` — Express routes (admin CRUD token, verify, control)
- `server/db.js` — better-sqlite3 storage (token + scadenza + revoked)
- `server/ha.js` — gate entity mapping + HA REST client
- `src/views/GateControl.vue` — public token UI (Apri/Chiudi)
- `src/views/AdminPanel.vue` — password-protected admin UI
- `docker-compose.yml` — prod compose (env via .env, volume varco_data)
- `deploy.sh` — manual build/push/deploy helper
- `.github/workflows/deploy.yml` — CI: push main → GHCR + Appleboy SSH deploy

## Entities HA (verified 2026-09-02)
- `switch.sonoff_1002658c25_1` = Cancello Andrea (`turn_on` apri, `turn_off` chiudi)
- `switch.sonoff_1002592ef9_1` = Cancello Alessandro

## Env vars
| Var | Required | Notes |
|-----|----------|-------|
| `ADMIN_PASSWORD` | yes | Admin UI password (never commit real one`
| `HA_BASE_URL` | yes | default `http://192.168.3.27:8123` |
| `HA_TOKEN` | yes | Long-lived HA token |
| `GATE_ANDREA_ENTITY` | no | override entity |
| `GATE_ALESSANDRO_ENTITY` | no | override entity |
| `PORT` | no | default 3000 |

## GitHub Actions secrets (repo → Settings → Secrets)
| Secret | Usato per |
|--------|-----------|
| `ORACLE_SSH_KEY` | ssh/scp verso `paraflu@jlide.duckdns.org` |
| `ADMIN_PASSWORD` | export → container |
| `HA_TOKEN` | export → container |
| `HA_BASE_URL` | export → container |

Il workflow copia `docker-compose.yml` in `~/varco-gates/` sul server via scp, poi `docker compose pull && up -d` con le env esportate dalla shell (niente .env file sul server). L'immagine GHCR va resa **public** dopo il primo push, altrimenti `docker pull` sul server fallisce.

## Operations
- **Regenerate tokens** → admin UI `/admin`
- **Add/remove gates** → `server/ha.js` (mapping) + frontend auto-lists from `/api/verify`
- **Deploy** → push main (CI), or `./deploy.sh <tag>` manually
- **Logs** → `docker compose -f ~/projects/varco-gates/docker-compose.yml logs -f varco-gates`
- **Backup** → `docker run --rm -v varco-gates_varco_data:/data -v $PWD:/backup alpine tar czf /backup/varco-data-$(date +%F).tar.gz -C /data .`

## Constraints
- NEVER commit real `ADMIN_PASSWORD`/`HA_TOKEN` (use .env`
- HA is NOT public: only Tailscale/LAN reachable → deploy host must reach `192.168.3.27:8123` (check `curl http://192.168.3.27:8123/api/` with auth from Oracle`)
- Token min TTL 60s, max 1y.

