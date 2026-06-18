# Cognito Auth Migration (Sub-project 1)

**Date:** 2026-06-18
**Status:** Approved (design)
**Repo:** chat-app (`server/`) + a cross-repo edit to `eventform/infra/cdk`

---

## Context

We are productionizing chat-app to mirror eventform's production posture: Cognito
auth, scale-to-zero EC2 ASG, Cloudflare Tunnel ingress, Cloudflare Pages SPA, SSM
secrets, GHCR images, OIDC deploy. That work is decomposed into four sub-projects,
each with its own spec → plan → implementation cycle.

### Full decomposition (for reference)

| # | Sub-project | Delivers | Depends on |
|---|---|---|---|
| **1** | **Cognito auth migration (backend)** — *this spec* | `AUTH_MODE=dev\|cognito`, jose JWKS id-token verifier on HTTP routes + socket.io handshake, JIT user provisioning by email, merge to one HTTP port, remove OTP/bcrypt/passport-local/SES. Plus a cross-repo edit: add a chat-app app client to eventform's AuthStack. | — |
| **2** | **Frontend → Cognito + Cloudflare Pages** | PKCE login (replace `Login.tsx`), id token on fetcher + socket, `ApiHealthGate` wake component, Pages build/env, CORS origins. | 1 |
| **3** | **Containerization** | Multi-stage `Dockerfile` for `server/`, `.dockerignore`, `docker-compose.prod.yml` (server + cloudflared) + local prod-smoke override. | 1 |
| **4** | **CDK + scale-to-zero + CI/CD** | `infra/cdk` ComputeStack (ASG, userdata, SSM, IMDSv2), wake Lambda + API GW, idle-check systemd, GitHub OIDC deploy role, multi-arch GHCR build + deploy workflow. | 1, 3 |

**Build order:** 1 → (2 ∥ 3) → 4.

### Locked decisions

- **Capacity:** scale-to-zero (requires Cognito to gate the wake endpoint).
- **Database:** MongoDB Atlas (external, free tier), region `ap-south-1`.
- **Scope:** backend + frontend.
- **Cognito pool:** reuse **eventform's** pool; add a dedicated chat-app app client.
  Reuse eventform's **Hosted UI domain `auth.murugappan.dev`** → one-login SSO across
  both apps (the SSO session cookie lives on the Hosted UI domain; separate callback
  URLs only isolate tokens/config, not the session).
- **Existing auth:** `AUTH_MODE=dev|cognito`; rip out OTP/bcrypt/passport-local/SES.
- **Identity mapping:** JIT-provision a `User` by verified email; existing `_id`-based
  relations unchanged.
- **Ports:** merge Express + socket.io onto one HTTP server / one port.
- **Compute:** EC2 `t4g.small`, arm64/Graviton, 10 GB gp3, `ap-south-1`.
  Cognito pool stays in `us-east-1`; cross-region JWKS/Hosted-UI is fine (HTTPS, cached).

---

## Sub-project 1 — detailed design

### 1. eventform AuthStack edit (cross-repo)

Add a second `UserPoolClient` to eventform's existing user pool for chat-app:

- Public client (PKCE, **no client secret**).
- OAuth flow: `authorization_code`. Scopes: `openid email profile`.
- Supported IdPs: Google + Cognito.
- Callback URLs: `https://chat.murugappan.dev/callback`, `http://localhost:5173/callback`.
- Logout URLs: `https://chat.murugappan.dev`, `http://localhost:5173`.
- **Reuses eventform's Hosted UI domain `auth.murugappan.dev`** (no new Cognito domain).
- CDK output: the new client id (consumed by chat-app's `COGNITO_CLIENT_ID`).

Deployed from the eventform repo. The pool id (→ issuer) and the new client id are the
two values chat-app needs.

### 2. `AUTH_MODE` seam — `server/src/config/env.ts`

**Add:** `AUTH_MODE` (`z.enum(['dev','cognito'])`), `COGNITO_ISSUER`
(`https://cognito-idp.us-east-1.amazonaws.com/<poolId>`), `COGNITO_CLIENT_ID`.

**Remove:** `JWT_SECRET`, `AWS_REGION`, `NOTIFICATIONS_EMAIL`, `WEBSOCKET_PORT`.

**Keep:** `DATABASE_URL` (Atlas), `CLIENT_URL`, `ADMIN_API_KEY` (admin-key middleware,
unrelated to user auth), `PORT`, `NODE_ENV`, `SENTRY_DSN`.

### 3. `CognitoTokenVerifier`

Mirrors eventform's verifier with one deliberate change: **verify the Cognito *id*
token, not the access token.** Rationale: we JIT-provision by email, and Cognito access
tokens do not carry email; id tokens do.

- `jose.createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))` (cached).
- `jwtVerify(token, jwks, { issuer })`.
- Assert `aud === COGNITO_CLIENT_ID` and `token_use === 'id'`.
- Returns `{ email, email_verified, sub }`.
- **Dev mode:** `Bearer dev_<email>` → no signature; returns `{ email, sub: 'dev_'+email, email_verified: true }`.

### 4. `requireAuth` middleware

Replaces passport-jwt. Extract Bearer token → mode-appropriate verifier →
`getOrCreateUserByEmail(email)` → attach Mongo `req.user`. Applied to `/user`, `/chat`,
`/message`.

### 5. Socket.io handshake auth

In `server/src/features/socket/index.ts`, replace `authJwtMW` inside `io.engine.use(...)`
with the same verifier (token from handshake `auth`/query), JIT-provision, attach
`socket.request.user`. Same handshake-vs-existing-connection branching as today.

### 6. JIT provisioning

`getOrCreateUserByEmail(email)` in user repository/service =
`findOneAndUpdate({ email }, { $setOnInsert: { ... } }, { upsert: true, new: true })`.
Chat/message relations key on user `_id` — unchanged.

### 7. Port merge

- `index.ts`: `const server = http.createServer(app)`; attach socket.io via
  `io.attach(server)`; `server.listen(env.PORT)`.
- `socket/index.ts`: keep `io = new Server({ cors })` (no own http server, no own
  `listen`); still `export { io }` so `message.service` import is stable.
- Remove the standalone `createServer()` + `server.listen(WEBSOCKET_PORT)`.
- One port, one tunnel hostname.

### 8. Removals + dependency trim

**Delete:** `otp.model`, `otp.repository`, OTP paths in `auth.service`, the `/auth` login
routes, `lib/bcrypt`, `lib/ses` (+ the `sendMail` call in `user.service`), `lib/passport`.

**Drop deps:** `bcrypt`, `passport`, `passport-jwt`, `passport-local`, `jsonwebtoken`,
`nodemailer`, `@aws-sdk/client-sesv2`, `@types/bcrypt`, `@types/passport-jwt`,
`@types/passport-local`, `@types/nodemailer`.

**Add dep:** `jose`.

### 9. CORS

Update `server/src/constants.ts` `corsList` to the Cloudflare Pages origin
(`https://chat.murugappan.dev`) + `http://localhost:5173`, replacing the Amplify regex.
(Final origin reconfirmed in Sub-project 2.)

---

## Data flow

```
SPA → Authorization: Bearer <idToken>
    → requireAuth → CognitoTokenVerifier (cached JWKS)
    → { email } → getOrCreateUserByEmail → req.user → route handler
```

Socket.io handshake takes the identical path and attaches `socket.request.user`.

## Error handling

- Invalid / expired / wrong-`aud` / wrong-`token_use` token → `401` (HTTP) or handshake
  rejection (socket).
- JWKS fetch failure → log to Sentry, respond `503`.

## Testing

- `CognitoTokenVerifier` unit-tested against a **local RSA keypair** (sign a fake id
  token, serve a local JWKS) — CI needs no AWS, same seam eventform uses.
- Dev-mode token parsing (`Bearer dev_<email>`).
- `getOrCreateUserByEmail` upsert idempotency.
- `requireAuth` returns `401` on missing/invalid token.

## Out of scope (later sub-projects)

- SPA PKCE login, token storage, `ApiHealthGate` (Sub-project 2).
- Dockerfile, compose, tunnel (Sub-project 3).
- CDK ComputeStack, wake Lambda, idle-check, CI/CD (Sub-project 4).

## Open items to confirm at implementation time

- eventform pool id (→ `COGNITO_ISSUER`) and the new app-client id (→ `COGNITO_CLIENT_ID`).
- Final SPA origin / domain (`chat.murugappan.dev` assumed).
- Whether any non-login use of SES remains in `user.service` (expected: none).
