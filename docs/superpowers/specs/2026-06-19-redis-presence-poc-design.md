# Managed Redis PoC — Redis-backed Socket Adapter + Presence

**Date:** 2026-06-19
**Status:** Approved (design)
**Repo:** chat-app — `server/` + `infra/`

## Context

Today the socket layer runs on a single instance: one `io` server (`socket/index.ts`)
and an in-memory presence registry (`features/presence/presence.ts`, a
`Map<email, connectionCount>`). The ASG runs `maxCapacity: 1` with scale-to-zero, so
this is correct for production as it stands.

This is a **proof-of-concept** to make the app **horizontally-ready** by moving the
socket fan-out and presence onto a **managed Redis (Redis Cloud, region ap-south-1)** —
a public TLS endpoint reached over `rediss://`, exactly like MongoDB Atlas
(`DATABASE_URL`): no VPC wiring, secret in SSM. We stay **single-instance and
scale-to-zero**; nothing about the deployment topology changes. The value is proving
the integration and the horizontal-ready architecture (which sub-project B's landing
page will describe).

## Locked decisions

- **Scope:** drop-in managed Redis, **single instance**. `maxCapacity` stays 1;
  scale-to-zero is untouched. No sticky sessions, no multi-instance — that is the
  documented *future* path, not built here.
- **Provider:** **Redis Cloud** free tier, region **ap-south-1** (co-located with the
  box). Public TLS endpoint, connected via **ioredis** on a `rediss://` URL.
- **What moves to Redis (both):**
  - The **socket.io Redis adapter** (`@socket.io/redis-adapter` + ioredis pub/sub) for
    cross-instance event fan-out.
  - The **presence registry** (shared online counts in Redis).
- **Optional with in-memory fallback:** `REDIS_URL` is **optional**. Set → Redis adapter
  + Redis presence. Unset → today's in-memory behavior, so local dev and the existing
  unit tests are untouched. This is what makes it a true *drop-in*.
- **Presence API goes async** (`addConnection`/`removeConnection`/`onlineEmails`/
  `isOnline` return Promises); the socket connection/disconnect handlers `await` them.
- **Boot reset:** on startup the single instance clears its Redis presence hash (nobody
  is connected yet at boot) — eliminating stale counts left by a previous box that
  scaled-to-zero without clean socket disconnects.

---

## Server

### Redis connection factory — `lib/redis/index.ts`
- Reads `env.REDIS_URL`. Returns `null` when unset (signals fallback).
- When set, creates an ioredis client. For `rediss://` URLs, TLS is enabled (ioredis
  infers TLS from the `rediss` scheme; pass `{}` tls options as needed).
- Exposes a singleton `pubClient` (normal commands + `PUBLISH`) and a lazily-created
  `subClient = pubClient.duplicate()` (subscriber mode — used only by the adapter).
  Presence commands run on `pubClient`. **2 connections total.**
- Connection errors are logged (winston) and do not crash the process; ioredis
  auto-reconnects.

### Presence interface — `features/presence/`
- Define a single API used by the socket layer:
  ```ts
  export interface Presence {
    addConnection(email: string): Promise<boolean>;    // true on 0->1
    removeConnection(email: string): Promise<boolean>;  // true on 1->0
    onlineEmails(): Promise<string[]>;
    isOnline(email: string): Promise<boolean>;
    reset(): Promise<void>;                              // boot reset / test reset
  }
  ```
- **`presence.memory.ts`** — the current `Map`-based logic, wrapped to satisfy the async
  interface (the existing transition semantics are preserved exactly).
- **`presence.redis.ts`** — Redis-backed via a single hash `presence:counts`
  (field = email, value = active connection count):
  - `addConnection`: `HINCRBY presence:counts <email> 1`; returns `result === 1`.
  - `removeConnection`: `HINCRBY presence:counts <email> -1`; if the new value `<= 0`,
    `HDEL presence:counts <email>` and return `true`; else `false`.
  - `onlineEmails`: `HGETALL` → keys whose value parses to `> 0`.
  - `isOnline`: `HGET` → `> 0`.
  - `reset`: `DEL presence:counts`.
- **`features/presence/index.ts`** — selects the implementation: if the Redis client
  exists, export the Redis presence; otherwise the in-memory one. This is the only
  module the rest of the server imports.

### Socket wiring — `socket/index.ts`
- When the Redis client exists, attach the adapter:
  `io.adapter(createAdapter(pubClient, subClient))`. When it does not, leave the default
  in-memory adapter (current behavior).
- The connection/disconnect handlers `await` the (now-async) presence calls:
  - on `connection`: `const wentOnline = await addConnection(email)`; emit
    `presence:state` (`await onlineEmails()`) to this socket; if `wentOnline`,
    `socket.broadcast.emit('presence:update', { email, online: true })` (fanned out by
    the adapter when Redis is on).
  - on `disconnect`: `const wentOffline = await removeConnection(email)`; if
    `wentOffline`, `io.emit('presence:update', { email, online: false })`.
- Activity stamping (`stampActivity()`) and join/leave are unchanged.

### Boot reset — `index.ts`
- On startup, after the presence implementation is resolved and before/just as the
  server listens, call `await presence.reset()`. Safe in both modes (clears the hash in
  Redis; clears the Map in memory). Correct because the only instance has just booted
  and holds no connections yet.

### Config — `config/env.ts`
- Add `REDIS_URL: z.string().url().optional()`.

---

## Infra (symmetric with the Atlas `DATABASE_URL` handling)

- **SSM:** new SecureString `/chat-app/redis-url` (the Redis Cloud `rediss://` URL with
  embedded credentials). Set out-of-band like the other secrets.
- **CDK (`compute-stack.ts`):** add `/chat-app/redis-url` to the box's SSM read policy
  and to the userdata's secret reads. **No VPC, security-group, or networking changes** —
  Redis Cloud is a public TLS endpoint just like Atlas.
- **Userdata / compose:** userdata materializes `REDIS_URL` into `.env`; the prod compose
  passes `REDIS_URL: ${REDIS_URL}` into the `server` service environment. Document the
  var in the compose header comment + `infra/compose/README.md`.
- **DEPLOYMENT.md:** add the `/chat-app/redis-url` SSM param to the secrets list, and a
  short note that the PoC uses Redis Cloud (ap-south-1) over public TLS.

---

## Data flow

Client connects → server `await addConnection(email)` (`HINCRBY`) → if 0→1, broadcast
`presence:update {online:true}` (adapter publishes to Redis → fans out to every node) →
this socket receives `presence:state` from `HGETALL`. Disconnect → `HINCRBY -1` /
`HDEL` → if 1→0, broadcast `{online:false}`. With one instance the adapter is effectively
a loopback, but the path is identical to the multi-instance case.

## Testing

- **Keep** the existing in-memory presence unit tests (now exercising `presence.memory.ts`
  through the async interface — transitions: 0→1 true, multi-connection counting, 1→0
  true, `onlineEmails`, `isOnline`).
- **Add** `presence.redis.test.ts` using **`ioredis-mock`**: same transition assertions
  against the Redis implementation (HINCRBY/HDEL/HGETALL behavior, `reset` clears).
- The selection module and adapter wiring are verified by the server booting with
  `REDIS_URL` set (manual/PoC check); no integration test infra is added.
- Server gates unchanged: `tsc --noEmit`, `npm test`.

## Scaling (the future path — NOT built here)

This PoC is the foundation. To actually scale horizontally later: bump the ASG
`maxCapacity` > 1, add **sticky sessions** at the ingress (Cloudflare Tunnel / load
balancer) so a client keeps hitting the same node for its websocket, and reconsider the
scale-to-zero idle-check (per-instance). The Redis adapter + Redis presence built here
already make the application layer correct for that move; only the deployment topology
would change. Documented in `docs/DEPLOYMENT.md`.

## Out of scope (YAGNI)

Multiple instances / sticky sessions / `maxCapacity` changes now; Redis persistence or
durability (presence + pub/sub are ephemeral and rebuilt on boot); Redis Streams adapter
(the pub/sub adapter is sufficient for the PoC); caching anything else (sessions, chat
data) in Redis; presence heartbeats/TTL (boot-reset covers the single-instance stale case).
