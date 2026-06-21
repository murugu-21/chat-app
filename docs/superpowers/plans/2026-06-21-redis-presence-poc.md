# Managed Redis PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the socket.io fan-out and presence registry onto managed Redis (Redis Cloud, ap-south-1) behind an optional, in-memory-fallback drop-in — keeping the app single-instance and scale-to-zero while making it horizontally-ready.

**Architecture:** Presence becomes an async `Presence` interface with two implementations (in-memory `Map`, Redis hash). A `lib/redis` factory returns an ioredis client when `REDIS_URL` is set (else `null`). The selection module picks Redis when the client exists; the socket layer attaches `@socket.io/redis-adapter` when Redis is configured. Infra mirrors the Atlas `DATABASE_URL` pattern: one new SSM SecureString, no VPC changes.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), socket.io 4, `@socket.io/redis-adapter`, ioredis, ioredis-mock (tests), vitest 4, AWS CDK, docker-compose.

## Global Constraints

- ESM project: all relative imports use the `.js` extension (e.g. `'./types.js'`), even from `.ts` source.
- `REDIS_URL` is **optional**. Set → Redis adapter + Redis presence. Unset/empty → in-memory fallback. An **empty string must be coerced to `undefined`** (docker-compose substitutes empty for an unset var, and a blank SSM read is possible).
- Presence transition semantics are preserved exactly: `addConnection` returns `true` only on 0→1; `removeConnection` returns `true` only on 1→0; unknown-email removal returns `false`.
- Deployment topology is unchanged: `maxCapacity` stays 1, scale-to-zero intact. No sticky sessions, no multi-instance.
- Provider is **Redis Cloud, region ap-south-1**, reached over a `redis://`/`rediss://` URL (TLS inferred from the scheme by ioredis). Secret lives in SSM at `/chat-app/redis-url` (SecureString).
- Run all server gates from `server/`: `npx tsc --noEmit` and `npm test`. Run CDK gates from `infra/cdk/`: `npx tsc --noEmit` and `npm test`.

---

## File Structure

- `server/src/features/presence/types.ts` — the `Presence` interface (new).
- `server/src/features/presence/presence.memory.ts` — `makeMemoryPresence()` async in-memory impl (new; replaces `presence.ts`).
- `server/src/features/presence/presence.redis.ts` — `makeRedisPresence(client)` Redis impl (new).
- `server/src/features/presence/index.ts` — `selectPresence()` + the exported `presence` singleton (new).
- `server/src/features/presence/presence.memory.test.ts` — memory impl tests (replaces `presence.test.ts`).
- `server/src/features/presence/presence.redis.test.ts` — Redis impl tests via ioredis-mock (new).
- `server/src/lib/redis/index.ts` — ioredis client factory (`redisClient`) + `makeSocketRedisAdapter` helper (new).
- `server/src/config/env.ts` — add `REDIS_URL`.
- `server/src/features/socket/index.ts` — import `presence`, await it, attach Redis adapter when configured.
- `server/src/index.ts` — boot-time `await presence.reset()`.
- `infra/compose/docker-compose.prod.yml` — pass `REDIS_URL` to the server service.
- `infra/cdk/lib/compute-stack.ts` — optional SSM read of `/chat-app/redis-url` in userdata.
- `infra/cdk/test/compute-stack.test.ts` — assert userdata references the param.
- `infra/compose/README.md`, `docs/DEPLOYMENT.md` — document the new secret.

---

### Task 1: Async presence interface + in-memory implementation (refactor, no Redis)

Replace the synchronous in-memory presence module with an async `Presence` interface + memory implementation + a selection module, and rewire the socket layer and bootstrap to use it. No Redis yet — the app behaves exactly as before, just async.

**Files:**
- Create: `server/src/features/presence/types.ts`
- Create: `server/src/features/presence/presence.memory.ts`
- Create: `server/src/features/presence/index.ts`
- Create: `server/src/features/presence/presence.memory.test.ts`
- Delete: `server/src/features/presence/presence.ts`
- Delete: `server/src/features/presence/presence.test.ts`
- Modify: `server/src/features/socket/index.ts:9` (import) and the connection/disconnect handlers
- Modify: `server/src/index.ts` (boot reset)

**Interfaces:**
- Produces:
  - `interface Presence { addConnection(email: string): Promise<boolean>; removeConnection(email: string): Promise<boolean>; onlineEmails(): Promise<string[]>; isOnline(email: string): Promise<boolean>; reset(): Promise<void>; }` in `types.ts`
  - `makeMemoryPresence(): Presence` in `presence.memory.ts`
  - `selectPresence(client: Redis | null): Presence` and `const presence: Presence` in `index.ts` (this task: `selectPresence` ignores its arg and always returns memory; Task 3 adds the Redis branch)
- Consumes: nothing from later tasks.

- [ ] **Step 1: Write the failing memory-presence test**

Create `server/src/features/presence/presence.memory.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { makeMemoryPresence } from './presence.memory.js';
import type { Presence } from './types.js';

describe('memory presence registry', () => {
    let presence: Presence;
    beforeEach(() => {
        presence = makeMemoryPresence();
    });

    it('first connection marks online (0->1 returns true)', async () => {
        expect(await presence.addConnection('a@x.com')).toBe(true);
        expect(await presence.isOnline('a@x.com')).toBe(true);
        expect(await presence.onlineEmails()).toEqual(['a@x.com']);
    });

    it('second connection does not re-signal online', async () => {
        await presence.addConnection('a@x.com');
        expect(await presence.addConnection('a@x.com')).toBe(false);
    });

    it('offline only when the last connection drops', async () => {
        await presence.addConnection('a@x.com');
        await presence.addConnection('a@x.com');
        expect(await presence.removeConnection('a@x.com')).toBe(false);
        expect(await presence.removeConnection('a@x.com')).toBe(true);
        expect(await presence.isOnline('a@x.com')).toBe(false);
    });

    it('removeConnection on an unknown email returns false', async () => {
        expect(await presence.removeConnection('nope@x.com')).toBe(false);
    });

    it('reset clears all counts', async () => {
        await presence.addConnection('a@x.com');
        await presence.reset();
        expect(await presence.onlineEmails()).toEqual([]);
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd server && npx vitest run src/features/presence/presence.memory.test.ts`
Expected: FAIL — cannot resolve `./presence.memory.js` / `./types.js`.

- [ ] **Step 3: Create the interface and memory implementation**

Create `server/src/features/presence/types.ts`:

```ts
// Presence registry: email -> online, tracked by active socket connection count.
// Async so a Redis-backed implementation can satisfy the same contract.
export interface Presence {
    addConnection(email: string): Promise<boolean>; // true on 0 -> 1
    removeConnection(email: string): Promise<boolean>; // true on 1 -> 0
    onlineEmails(): Promise<string[]>;
    isOnline(email: string): Promise<boolean>;
    reset(): Promise<void>; // boot reset / test reset
}
```

Create `server/src/features/presence/presence.memory.ts`:

```ts
import type { Presence } from './types.js';

// In-memory presence: email -> active socket connection count. Correct for a
// single instance (ASG maxCapacity=1); the Redis impl is used when REDIS_URL is set.
export const makeMemoryPresence = (): Presence => {
    const counts = new Map<string, number>();
    return {
        async addConnection(email) {
            const next = (counts.get(email) ?? 0) + 1;
            counts.set(email, next);
            return next === 1;
        },
        async removeConnection(email) {
            const current = counts.get(email) ?? 0;
            if (current <= 0) return false;
            if (current === 1) {
                counts.delete(email);
                return true;
            }
            counts.set(email, current - 1);
            return false;
        },
        async onlineEmails() {
            return [...counts.keys()];
        },
        async isOnline(email) {
            return (counts.get(email) ?? 0) > 0;
        },
        async reset() {
            counts.clear();
        },
    };
};
```

- [ ] **Step 4: Run the memory test to confirm it passes**

Run: `cd server && npx vitest run src/features/presence/presence.memory.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the selection module**

Create `server/src/features/presence/index.ts`. (`selectPresence` takes a client arg now so Task 3 only edits its body, not its callers. In this task the Redis branch is not wired yet, so the parameter is typed loosely and unused.)

```ts
import { makeMemoryPresence } from './presence.memory.js';
import type { Presence } from './types.js';

// Selects the presence implementation. Task 3 adds the Redis branch; for now
// the in-memory implementation is always used.
export const selectPresence = (_client: unknown | null): Presence => {
    return makeMemoryPresence();
};

export const presence: Presence = selectPresence(null);
```

- [ ] **Step 6: Delete the old presence module + test**

```bash
cd server
git rm src/features/presence/presence.ts src/features/presence/presence.test.ts
```

- [ ] **Step 7: Rewire the socket layer**

In `server/src/features/socket/index.ts`, replace the import on line 9:

```ts
import { presence } from '../presence/index.js';
```

Replace the `io.on('connection', ...)` handler so the presence calls are awaited (make the connection and disconnect listeners `async`):

```ts
io.on('connection', async (socket) => {
    stampActivity();
    const email = (socket.request as any).user?.email as string | undefined;
    if (email) {
        const wentOnline = await presence.addConnection(email);
        socket.emit('presence:state', await presence.onlineEmails());
        if (wentOnline) socket.broadcast.emit('presence:update', { email, online: true });
    }

    socket.on('disconnect', async () => {
        if (email && (await presence.removeConnection(email))) {
            io.emit('presence:update', { email, online: false });
        }
    });

    socket.on('join', async (chatId, callback) => {
        try {
            const chat = await chatService.getChatForUser({
                userId: (socket.request as any).user._id,
                chatId,
            });
            await socket.join(`message:${chat.chatId}`);
        } catch (e) {
            callback({ status: 'NOK' });
        }
    });

    socket.on('leave', async (chatId, callback) => {
        try {
            const chat = await chatService.getChatForUser({
                userId: (socket.request as any).user._id,
                chatId,
            });
            await socket.leave(`message:${chat.chatId}`);
        } catch (e) {
            callback({ status: 'NOK' });
        }
    });
});
```

- [ ] **Step 8: Add the boot reset**

In `server/src/index.ts`, add the import alongside the other feature imports:

```ts
import { presence } from './features/presence/index.js';
```

Then add a reset just before `server.listen(...)` (top-level `await` is already used for `mongoose.connect`, so this is valid):

```ts
// Clear presence at boot: the single instance has just started and holds no
// connections yet, so any pre-existing entries (e.g. left by a box that
// scaled-to-zero without clean disconnects) are stale.
await presence.reset();

server.listen(env.PORT, () => {
```

- [ ] **Step 9: Typecheck + full suite**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (the new memory test included; socket auth test unaffected).

- [ ] **Step 10: Commit**

```bash
cd server && git add -A
git commit -m "refactor(presence): async Presence interface + in-memory impl"
```

---

### Task 2: Redis client factory + Redis presence implementation

Add the Redis dependencies and `REDIS_URL` config, a `lib/redis` factory (client-or-null + socket-adapter helper), and the Redis-backed presence implementation with tests. Purely additive — nothing wires these into the running app yet (Task 3 does), so behavior is unchanged.

**Files:**
- Modify: `server/package.json` (+ `package-lock.json` via npm)
- Modify: `server/src/config/env.ts`
- Create: `server/src/lib/redis/index.ts`
- Create: `server/src/features/presence/presence.redis.ts`
- Create: `server/src/features/presence/presence.redis.test.ts`
- Create: `server/src/lib/redis/redis.test.ts`

**Interfaces:**
- Consumes: `Presence` from `./types.js` (Task 1).
- Produces:
  - `redisClient: Redis | null` and `makeSocketRedisAdapter(client: Redis)` in `lib/redis/index.ts`
  - `makeRedisPresence(client: Redis): Presence` in `presence.redis.ts`
  - `env.REDIS_URL: string | undefined`

- [ ] **Step 1: Install dependencies**

```bash
cd server
npm install ioredis @socket.io/redis-adapter
npm install -D ioredis-mock
```
Expected: `ioredis` and `@socket.io/redis-adapter` in `dependencies`, `ioredis-mock` in `devDependencies`.

- [ ] **Step 2: Add `REDIS_URL` to env (empty-string → undefined)**

In `server/src/config/env.ts`, add this entry to the `server` object, immediately after the `COGNITO_CLIENT_ID` line:

```ts
        // Managed Redis (Redis Cloud) connection URL. Optional: when unset the
        // app uses in-memory presence + the default socket adapter. docker-compose
        // substitutes "" for an unset var, so coerce empty -> undefined.
        REDIS_URL: z.preprocess(
            (v) => (v === '' ? undefined : v),
            z.string().url().optional(),
        ),
```

- [ ] **Step 3: Write the failing Redis-presence test**

Create `server/src/features/presence/presence.redis.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';

import { makeRedisPresence } from './presence.redis.js';
import type { Presence } from './types.js';

describe('redis presence registry', () => {
    let presence: Presence;
    beforeEach(async () => {
        const client = new RedisMock() as unknown as Redis;
        await client.flushall();
        presence = makeRedisPresence(client);
    });

    it('first connection marks online (0->1 returns true)', async () => {
        expect(await presence.addConnection('a@x.com')).toBe(true);
        expect(await presence.isOnline('a@x.com')).toBe(true);
        expect(await presence.onlineEmails()).toEqual(['a@x.com']);
    });

    it('second connection does not re-signal online', async () => {
        await presence.addConnection('a@x.com');
        expect(await presence.addConnection('a@x.com')).toBe(false);
    });

    it('offline only when the last connection drops', async () => {
        await presence.addConnection('a@x.com');
        await presence.addConnection('a@x.com');
        expect(await presence.removeConnection('a@x.com')).toBe(false);
        expect(await presence.removeConnection('a@x.com')).toBe(true);
        expect(await presence.isOnline('a@x.com')).toBe(false);
    });

    it('removeConnection on an unknown email returns false', async () => {
        expect(await presence.removeConnection('nope@x.com')).toBe(false);
    });

    it('reset clears all counts', async () => {
        await presence.addConnection('a@x.com');
        await presence.reset();
        expect(await presence.onlineEmails()).toEqual([]);
    });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `cd server && npx vitest run src/features/presence/presence.redis.test.ts`
Expected: FAIL — cannot resolve `./presence.redis.js`.

- [ ] **Step 5: Implement the Redis presence**

Create `server/src/features/presence/presence.redis.ts`:

```ts
import type { Redis } from 'ioredis';

import type { Presence } from './types.js';

const KEY = 'presence:counts';

// Redis-backed presence: a single hash mapping email -> active connection count.
// Connection counting handles multiple tabs/devices across instances.
export const makeRedisPresence = (client: Redis): Presence => ({
    async addConnection(email) {
        const next = await client.hincrby(KEY, email, 1);
        return next === 1;
    },
    async removeConnection(email) {
        const next = await client.hincrby(KEY, email, -1);
        if (next <= 0) {
            await client.hdel(KEY, email);
            return next === 0; // true only on the 1 -> 0 transition
        }
        return false;
    },
    async onlineEmails() {
        const all = await client.hgetall(KEY);
        return Object.entries(all)
            .filter(([, v]) => Number(v) > 0)
            .map(([email]) => email);
    },
    async isOnline(email) {
        const v = await client.hget(KEY, email);
        return v !== null && Number(v) > 0;
    },
    async reset() {
        await client.del(KEY);
    },
});
```

- [ ] **Step 6: Run the Redis-presence test to confirm it passes**

Run: `cd server && npx vitest run src/features/presence/presence.redis.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Write the failing redis-factory test**

Create `server/src/lib/redis/redis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';

import { makeSocketRedisAdapter } from './index.js';

describe('makeSocketRedisAdapter', () => {
    it('returns a socket.io adapter factory (a constructor function)', () => {
        const client = new RedisMock() as unknown as Redis;
        const adapter = makeSocketRedisAdapter(client);
        expect(typeof adapter).toBe('function');
    });
});
```

- [ ] **Step 8: Run it to confirm it fails**

Run: `cd server && npx vitest run src/lib/redis/redis.test.ts`
Expected: FAIL — cannot resolve `./index.js`.

- [ ] **Step 9: Implement the Redis factory**

Create `server/src/lib/redis/index.ts`:

```ts
import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

import env from '../../config/env.js';

// One ioredis client when REDIS_URL is set (rediss:// enables TLS automatically),
// or null to signal the in-memory fallback. ioredis auto-reconnects; log errors
// to stderr rather than crashing the process.
export const redisClient: Redis | null = env.REDIS_URL
    ? new Redis(env.REDIS_URL)
    : null;

redisClient?.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[redis] client error:', err.message);
});

// Socket.IO Redis adapter factory. The adapter needs a pub client (this one) and
// a sub client (a duplicate, used in subscriber mode). Pure + unit-testable.
export const makeSocketRedisAdapter = (client: Redis) =>
    createAdapter(client, client.duplicate());
```

- [ ] **Step 10: Run the factory test to confirm it passes**

Run: `cd server && npx vitest run src/lib/redis/redis.test.ts`
Expected: PASS.

- [ ] **Step 11: Typecheck + full suite**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 12: Commit**

```bash
cd server && git add -A
git commit -m "feat(redis): ioredis factory + Redis-backed presence (not yet wired)"
```

---

### Task 3: Wire Redis into presence selection + the socket adapter

Flip the selection module to use Redis when a client exists, and attach the socket.io Redis adapter when configured. With `REDIS_URL` unset (local/tests) nothing changes; with it set the app uses Redis end-to-end.

**Files:**
- Modify: `server/src/features/presence/index.ts`
- Create: `server/src/features/presence/selection.test.ts`
- Modify: `server/src/features/socket/index.ts`

**Interfaces:**
- Consumes: `redisClient`, `makeSocketRedisAdapter` from `lib/redis` (Task 2); `makeRedisPresence` from `presence.redis.ts` (Task 2); `makeMemoryPresence` (Task 1).
- Produces: no new exported symbols (behavior wiring only).

- [ ] **Step 1: Write the failing selection test**

Create `server/src/features/presence/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';

import { selectPresence } from './index.js';

describe('presence selection', () => {
    it('uses in-memory presence when there is no Redis client', async () => {
        const presence = selectPresence(null);
        expect(await presence.addConnection('a@x.com')).toBe(true);
        expect(await presence.onlineEmails()).toEqual(['a@x.com']);
    });

    it('uses Redis presence (writes to the provided client) when a client is given', async () => {
        const client = new RedisMock() as unknown as Redis;
        const presence = selectPresence(client);
        await presence.addConnection('b@x.com');
        // Proves the Redis impl is selected: the count lands in the given client.
        expect(await (client as unknown as { hget: (k: string, f: string) => Promise<string | null> }).hget('presence:counts', 'b@x.com')).toBe('1');
        expect(await presence.onlineEmails()).toEqual(['b@x.com']);
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd server && npx vitest run src/features/presence/selection.test.ts`
Expected: FAIL — `selectPresence` currently ignores its arg and returns memory, so the provided Redis client's `presence:counts` hash stays empty and the `hget(...) === '1'` assertion fails. This is the genuine red.

- [ ] **Step 3: Branch the selection on the client**

Replace the body of `server/src/features/presence/index.ts`:

```ts
import type { Redis } from 'ioredis';

import { redisClient } from '../../lib/redis/index.js';
import { makeMemoryPresence } from './presence.memory.js';
import { makeRedisPresence } from './presence.redis.js';
import type { Presence } from './types.js';

// Redis when a client exists, otherwise in-memory.
export const selectPresence = (client: Redis | null): Presence => {
    return client ? makeRedisPresence(client) : makeMemoryPresence();
};

export const presence: Presence = selectPresence(redisClient);
```

- [ ] **Step 4: Run the selection test to confirm it passes**

Run: `cd server && npx vitest run src/features/presence/selection.test.ts`
Expected: PASS (2 tests) — the Redis branch is now exercised via ioredis-mock.

- [ ] **Step 5: Attach the socket adapter when Redis is configured**

In `server/src/features/socket/index.ts`, add the import near the top:

```ts
import { redisClient, makeSocketRedisAdapter } from '../../lib/redis/index.js';
```

Then, immediately after `const io = new Server({ ... });`, attach the adapter conditionally:

```ts
if (redisClient) {
    io.adapter(makeSocketRedisAdapter(redisClient));
}
```

- [ ] **Step 6: Typecheck + full suite**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass. (`REDIS_URL` is unset in the test/dev env, so `redisClient` is `null` → memory path, default adapter — no regression.)

- [ ] **Step 7: Manual PoC sanity (optional, requires a Redis URL)**

With a Redis Cloud URL exported, confirm the server boots and uses Redis:

```bash
cd server && REDIS_URL='rediss://default:<pw>@<host>:<port>' npm run dev
```
Expected: server starts with no Redis errors; `presence:counts` appears in the Redis DB after a socket connects. (Skip if no URL is handy — the units cover the logic.)

- [ ] **Step 8: Commit**

```bash
cd server && git add -A
git commit -m "feat(redis): use Redis presence + socket adapter when REDIS_URL is set"
```

---

### Task 4: Infra wiring + docs

Pass `REDIS_URL` into the prod container, read `/chat-app/redis-url` from SSM at boot (tolerating a missing param), and document the new secret. No IAM change — the role already grants `parameter/chat-app/*`.

**Files:**
- Modify: `infra/compose/docker-compose.prod.yml`
- Modify: `infra/cdk/lib/compute-stack.ts`
- Modify: `infra/cdk/test/compute-stack.test.ts`
- Modify: `infra/compose/README.md`
- Modify: `docs/DEPLOYMENT.md`

**Interfaces:**
- Consumes: the server's `REDIS_URL` env contract (Task 2).
- Produces: nothing code-facing.

- [ ] **Step 1: Pass `REDIS_URL` to the server service**

In `infra/compose/docker-compose.prod.yml`, add to the `server.environment` block (after `LOG_DIR: /tmp/chat-app`):

```yaml
      # Managed Redis (Redis Cloud). Optional — empty when the SSM param is unset,
      # which the server coerces to "no Redis" (in-memory fallback).
      REDIS_URL: ${REDIS_URL}
```

Also add `REDIS_URL` to the `# x-required-env:` header comment list near the top of the file:

```yaml
#   REDIS_URL          Managed Redis (Redis Cloud) connection URL — optional
```

- [ ] **Step 2: Read the optional SSM param in userdata**

In `infra/cdk/lib/compute-stack.ts`, just after the `get()` helper definition (the line defining `get()`), add an `opt()` helper that tolerates a missing parameter:

```ts
      "opt() { aws ssm get-parameter --region \"$REGION\" --name \"$1\" --with-decryption --query Parameter.Value --output text 2>/dev/null || true; }",
```

Then add a `REDIS_URL` line inside the `{ ... } > .env` block, after the `TUNNEL_TOKEN` line:

```ts
      '  echo "REDIS_URL=$(opt /chat-app/redis-url)"',
```

(`opt` prints an empty string when the param does not exist, so `REDIS_URL=` is written and the server coerces it to undefined. `get` would abort the script under `set -e`; `opt` must be used here.)

- [ ] **Step 3: Write the failing CDK test**

In `infra/cdk/test/compute-stack.test.ts`, add inside the `describe("ComputeStack", ...)` block:

```ts
  it("userdata reads the optional Redis URL from SSM", () => {
    const t = template();
    const lts = t.findResources("AWS::EC2::LaunchTemplate");
    const userData = JSON.stringify(
      Object.values(lts)[0].Properties.LaunchTemplateData.UserData,
    );
    expect(userData).toContain("/chat-app/redis-url");
  });
```

- [ ] **Step 4: Run it to confirm it fails, then passes**

Run: `cd infra/cdk && npx vitest run test/compute-stack.test.ts`
Expected: FAIL before Step 2's edit is in place; PASS after. (If Step 2 is already applied, it passes immediately — that is acceptable for an infra config task.)

- [ ] **Step 5: Document the secret**

In `infra/compose/README.md`, add `REDIS_URL` to the list of env vars materialized from SSM (note it is optional).

In `docs/DEPLOYMENT.md`, add `/chat-app/redis-url` (SecureString) to the SSM parameters list/table — same place `/chat-app/tunnel-token` is listed — with the note: "Redis Cloud (ap-south-1) connection URL; optional — unset falls back to in-memory presence."

- [ ] **Step 6: Typecheck + CDK suite**

Run: `cd infra/cdk && npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (including the new userdata assertion).

- [ ] **Step 7: Commit**

```bash
git add infra/compose/docker-compose.prod.yml infra/cdk/lib/compute-stack.ts infra/cdk/test/compute-stack.test.ts infra/compose/README.md docs/DEPLOYMENT.md
git commit -m "infra(redis): pass REDIS_URL through SSM -> compose -> server"
```

---

## Deployment notes (after the branch merges — not a code task)

- The server image must be **rebuilt** so `ioredis` + `@socket.io/redis-adapter` are baked in: trigger the `Deploy` workflow via **workflow_dispatch on `main`** (a `v*` tag does not refresh `:latest`).
- Create the SSM secret out-of-band: `aws ssm put-parameter --name /chat-app/redis-url --type SecureString --value '<redis-cloud-url>' --overwrite` (eventform profile, ap-south-1).
- The box picks up `REDIS_URL` on its next launch (wake / scale-up). No CDK redeploy is required for the param value itself, but the userdata change (Step 2) does require `cdk deploy ChatAppCompute` so new instances read the param.

---

## Self-Review

**Spec coverage:** Redis adapter (Task 3) ✓; Redis presence hash with HINCRBY/HDEL/HGETALL/HGET/DEL (Task 2) ✓; in-memory fallback via optional `REDIS_URL` (Tasks 2–3, empty→undefined) ✓; async presence interface + socket awaits (Task 1) ✓; boot reset (Task 1) ✓; `lib/redis` 2-connection factory (Task 2) ✓; SSM `/chat-app/redis-url` + userdata + compose + no VPC change (Task 4) ✓; keep memory tests + add ioredis-mock tests (Tasks 1–3) ✓; docs (Task 4) ✓; scale-to-zero/single-instance unchanged (Global Constraints) ✓.

**Placeholder scan:** none — every code step shows full code; the one "may already pass" note (Task 4 Step 4, Task 3 Step 2) is an explicit acknowledgement of an infra/branch-coincidence, not a TODO.

**Type consistency:** `Presence` interface identical across `presence.memory.ts`, `presence.redis.ts`, `selectPresence`, and `presence`. `makeRedisPresence(client: Redis)`, `makeSocketRedisAdapter(client: Redis)`, `redisClient: Redis | null`, `selectPresence(client: Redis | null)` all agree. `env.REDIS_URL: string | undefined` consumed only by `lib/redis`.
