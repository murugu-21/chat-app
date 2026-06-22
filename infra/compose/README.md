# chat-app infra/compose

Backend production container stack: the chat-app server + a Cloudflare Tunnel.
MongoDB is external (Atlas) — there is no on-box database.

## Files
- `docker-compose.prod.yml` — prod stack: `server` (GHCR image) + `cloudflared`
  (outbound tunnel, no inbound ports). Env is materialized into `.env` on the
  box from SSM (see SP4).
- `docker-compose.prod-local.override.yml` — local smoke: dev auth, published
  port, no tunnel. You supply `DATABASE_URL`.

## Local smoke test
```bash
cd infra/compose
export DATABASE_URL="<your mongo connection string>"
docker compose \
  -f docker-compose.prod.yml \
  -f docker-compose.prod-local.override.yml \
  up --build
curl http://localhost:3000/health   # -> {"message":"OK"}
docker compose -f docker-compose.prod.yml down
```

## Required env (prod)
`ADMIN_API_KEY`, `DATABASE_URL`, `CLIENT_URL`, `SENTRY_DSN`, `COGNITO_ISSUER`,
`COGNITO_CLIENT_ID`, `TUNNEL_TOKEN`. (`NODE_ENV`, `PORT`, `AUTH_MODE` are pinned
in the compose file.)

`REDIS_URL` is **optional** — materialized from SSM `/chat-app/redis-url` at boot
(via the `opt()` helper, which tolerates a missing param). When absent or empty, the
server falls back to in-memory presence/pub-sub.
