# Containerization (Sub-project 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Produce the production container artifacts for the chat-app backend — a multi-stage `server/Dockerfile`, a `.dockerignore`, and `infra/compose/` files (prod + local-smoke override) mirroring eventform's pattern.

**Architecture:** Single image runs the post-SP1 server (one HTTP port, Express + socket.io, external MongoDB Atlas). The prod compose runs `server` + a `cloudflared` outbound tunnel (no inbound ports, no on-box DB). A local override runs the same image offline-ish in `AUTH_MODE=dev` with a published port and no tunnel; the operator supplies `DATABASE_URL` (Atlas) via env.

**Tech Stack:** Docker (multi-stage, `node:22-alpine`), docker compose v2, cloudflared.

## Global Constraints

- Base image `node:22-alpine` (matches eventform).
- Image name `ghcr.io/murugu-21/chat-app-server`.
- The container runs `CMD ["node","build/index.js"]` — NOT the `prod` npm script (which uses `--env-file=.env`); env is injected by compose.
- The Docker build MUST copy `@types/` as well as `src/` and `tsconfig.json` — tsconfig has no explicit `include`, so tsc compiles `**/*` and needs the `Express.Request` augmentation in `server/@types/express/index.d.ts`.
- Runtime env vars (9): `NODE_ENV`, `ADMIN_API_KEY`, `PORT`, `DATABASE_URL`, `CLIENT_URL`, `SENTRY_DSN`, `AUTH_MODE`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID`.
- No on-box database; MongoDB is external (Atlas), passed via `DATABASE_URL`.
- Multi-arch GHCR build/push and the SSM-materialized `.env` are SP4 — not here. SP3 artifacts must build and `docker compose config`-validate locally.
- Commands run from the repo root `/Users/murugappan/personal/chat-app` unless noted.

---

### Task 1: server Dockerfile + .dockerignore

**Files:**
- Create: `server/Dockerfile`
- Delete: `server/.Dockerfile` (the old rough one)
- Create: `server/.dockerignore`

**Interfaces:**
- Produces: an image whose entrypoint is `node build/index.js`, exposing port 3000.

- [ ] **Step 1: Write `server/.dockerignore`**

```
node_modules
build
.env
.env.*
.git
*.log
**/*.test.ts
Dockerfile
.dockerignore
```

- [ ] **Step 2: Write `server/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY @types ./@types
RUN npm run build && npm prune --production

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=prod
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "build/index.js"]
```

- [ ] **Step 3: Remove the old Dockerfile**

```bash
git rm server/.Dockerfile
```

- [ ] **Step 4: Build the image (verification)**

Run: `docker build -t chat-app-server:plan-test ./server`
Expected: build SUCCEEDS through both stages (the `npm run build` tsc step passes — confirms `@types` was copied).

- [ ] **Step 5: Confirm the image entrypoint and that build output is present**

Run: `docker run --rm --entrypoint sh chat-app-server:plan-test -c "test -f build/index.js && echo OK"`
Expected: prints `OK`.

(Do NOT try to fully boot the server — it connects to MongoDB at startup and has no DB/env here; build + artifact presence is the gate.)

- [ ] **Step 6: Commit**

```bash
git add server/Dockerfile server/.dockerignore
git rm server/.Dockerfile
git commit -m "feat: add multi-stage Dockerfile + dockerignore for server"
```

---

### Task 2: prod docker-compose

**Files:**
- Create: `infra/compose/docker-compose.prod.yml`

**Interfaces:**
- Consumes: the image from Task 1.
- Produces: a compose file that `docker compose config` validates, defining `server` + `cloudflared`.

- [ ] **Step 1: Write `infra/compose/docker-compose.prod.yml`**

```yaml
# x-required-env: document every ${VAR} used in this file
#   ADMIN_API_KEY      admin-key middleware secret (uuid)
#   DATABASE_URL       MongoDB Atlas connection string (external)
#   CLIENT_URL         SPA origin (https://chat.murugappan.dev)
#   SENTRY_DSN         Sentry ingest URL
#   COGNITO_ISSUER     https://cognito-idp.us-east-1.amazonaws.com/<poolId>
#   COGNITO_CLIENT_ID  chat-app Cognito app client id
#   TUNNEL_TOKEN       Cloudflare Tunnel token
#
# MongoDB is external (Atlas). There is NO on-box database here. Secrets are
# materialized into .env on the box from SSM in SP4.

name: chat-app-prod

services:
  server:
    image: ghcr.io/murugu-21/chat-app-server:latest
    build:
      context: ../../server
    restart: unless-stopped
    environment:
      NODE_ENV: prod
      PORT: "3000"
      AUTH_MODE: cognito
      ADMIN_API_KEY: ${ADMIN_API_KEY}
      DATABASE_URL: ${DATABASE_URL}
      CLIENT_URL: ${CLIENT_URL}
      SENTRY_DSN: ${SENTRY_DSN}
      COGNITO_ISSUER: ${COGNITO_ISSUER}
      COGNITO_CLIENT_ID: ${COGNITO_CLIENT_ID}
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on:
      server:
        condition: service_healthy
```

- [ ] **Step 2: Validate the compose file**

Run (from repo root):
```bash
ADMIN_API_KEY=x DATABASE_URL=x CLIENT_URL=https://chat.murugappan.dev SENTRY_DSN=https://a@b.ingest.sentry.io/1 COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/p COGNITO_CLIENT_ID=c TUNNEL_TOKEN=t docker compose -f infra/compose/docker-compose.prod.yml config >/dev/null && echo "CONFIG OK"
```
Expected: prints `CONFIG OK` (YAML + interpolation valid). A warning-free run; note any warnings as findings.

- [ ] **Step 3: Commit**

```bash
git add infra/compose/docker-compose.prod.yml
git commit -m "feat: add prod docker-compose (server + cloudflared tunnel)"
```

---

### Task 3: local prod-smoke override + usage README

**Files:**
- Create: `infra/compose/docker-compose.prod-local.override.yml`
- Create: `infra/compose/README.md`

**Interfaces:**
- Consumes: the prod compose from Task 2.
- Produces: an override that runs the prod image locally in dev-auth mode with a published port and no tunnel.

- [ ] **Step 1: Write `infra/compose/docker-compose.prod-local.override.yml`**

```yaml
# Local prod-smoke override: runs the prod image with dev auth, a published
# port, and no Cloudflare tunnel. Supply DATABASE_URL yourself (e.g. an Atlas
# URL or a locally-run mongo) via the shell env or an .env file in this dir.
#
#   docker compose \
#     -f docker-compose.prod.yml \
#     -f docker-compose.prod-local.override.yml \
#     up --build
#
# Then: curl http://localhost:3000/health  -> {"message":"OK"}

name: chat-app-prod

services:
  server:
    environment:
      NODE_ENV: local
      AUTH_MODE: dev
    ports:
      - "3000:3000"

  # Tunnel is not used locally. Override its command to a no-op so the prod
  # file's cloudflared service doesn't try to dial out with a missing token.
  cloudflared:
    profiles: ["disabled"]
```

- [ ] **Step 2: Write `infra/compose/README.md`**

```markdown
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
```

- [ ] **Step 3: Validate the merged (prod + override) config**

Run (from `infra/compose`):
```bash
cd infra/compose && DATABASE_URL=mongodb://localhost:27017 ADMIN_API_KEY=x CLIENT_URL=http://localhost:5173 SENTRY_DSN=https://a@b.ingest.sentry.io/1 COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/p COGNITO_CLIENT_ID=c docker compose -f docker-compose.prod.yml -f docker-compose.prod-local.override.yml config >/dev/null && echo "OVERRIDE CONFIG OK"
```
Expected: prints `OVERRIDE CONFIG OK`; the merged config shows `server` with `AUTH_MODE: dev`, `ports: 3000:3000`, and `cloudflared` under the `disabled` profile (so a default `up` skips it).

- [ ] **Step 4: Commit**

```bash
git add infra/compose/docker-compose.prod-local.override.yml infra/compose/README.md
git commit -m "feat: add local prod-smoke compose override + infra README"
```

---

## Self-Review

- Dockerfile copies `@types` (Global Constraint) → Task 1 Step 2. ✓
- CMD is `node build/index.js`, not the env-file `prod` script → Task 1 Step 2. ✓
- prod compose: server + cloudflared, external DB, /health healthcheck, 9 env vars → Task 2. ✓
- local override: dev auth, published port, no tunnel, operator-supplied DATABASE_URL (no bundled mongo) → Task 3. ✓
- All gates use real `docker build` / `docker compose config` (Docker is available). ✓
- No placeholders; full file contents in every step. ✓

## Not in this plan (SP4)
Multi-arch GHCR build+push, the SSM→`.env` materialization, the EC2 userdata that runs `docker compose -f docker-compose.prod.yml up -d`, and the Cloudflare Tunnel hostname→`server:3000` mapping.
