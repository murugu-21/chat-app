# Cognito Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace chat-app's OTP/bcrypt/passport-local auth with Cognito id-token verification (dev-mode fallback), JIT-provision users by email, and merge the API + socket.io onto one HTTP port — all in `server/`.

**Architecture:** A pure `makeVerifier` factory validates either a `dev_<email>` token or a Cognito **id** token (jose JWKS, `token_use==='id'`, `aud===clientId`) and returns `{ email, emailVerified, sub }`. An env-wired `verifyToken` instance is consumed by a `requireAuth` Express middleware and a socket.io `io.use` middleware; both JIT-upsert the Mongo `User` by email. The standalone socket server is removed — socket.io attaches to the single Express HTTP server.

**Tech Stack:** TypeScript (NodeNext ESM), Express 4, socket.io 4, mongoose 8, `jose` (JWKS/JWT), vitest + mongodb-memory-server (tests).

## Global Constraints

- **ESM / NodeNext:** all relative imports use the `.js` suffix (e.g. `./foo.js`), even from `.ts` sources. Copy this in every new file.
- **No AWS in tests:** the verifier is tested against a local RSA keypair via `jose.createLocalJWKSet`; DB code is tested against `mongodb-memory-server`. Never require real Cognito/Atlas in a test.
- **Build stays green at every commit:** new code is added before old code is rewired, and dead code/deps are deleted last. Run `npx tsc --noEmit` before any commit that touches imports.
- **Verify the *id* token, not the access token** (`token_use === 'id'`) — chat-app JIT-provisions by email, which only id tokens carry.
- **Cognito pool is eventform's**, in `us-east-1`; issuer = `https://cognito-idp.us-east-1.amazonaws.com/<poolId>`. Pool id + client id are supplied at deploy time, not needed for tests.
- All commands below run from `server/` unless stated otherwise.

---

### Task 1: Test harness (vitest + mongodb-memory-server)

**Files:**
- Modify: `server/package.json` (devDeps + `test` script)
- Create: `server/vitest.config.ts`
- Test: `server/src/__tests__/sanity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (vitest) that later tasks add tests to.

- [ ] **Step 1: Install test + crypto deps**

```bash
npm install --save-dev vitest mongodb-memory-server supertest @types/supertest
npm install jose
```

- [ ] **Step 2: Fix the `test` script (currently self-recursive) and confirm**

Edit `server/package.json` scripts so `test` is:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // mongodb-memory-server downloads a binary on first run; give it room.
        testTimeout: 30000,
        hookTimeout: 30000,
    },
});
```

- [ ] **Step 4: Write a sanity test** — `server/src/__tests__/sanity.test.ts`

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
    it('runs', () => {
        expect(1 + 1).toBe(2);
    });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/__tests__/sanity.test.ts
git commit -m "test: add vitest + mongodb-memory-server harness, add jose"
```

---

### Task 2: Cognito token verifier (pure factory)

**Files:**
- Create: `server/src/lib/auth/cognito.verifier.ts`
- Test: `server/src/lib/auth/cognito.verifier.test.ts`

**Interfaces:**
- Consumes: `jose`.
- Produces:
  - `type VerifiedIdentity = { email: string; emailVerified: boolean; sub: string }`
  - `type Verifier = (token: string) => Promise<VerifiedIdentity>`
  - `makeVerifier(opts: { mode: 'dev' | 'cognito'; issuer?: string; clientId?: string; jwks?: import('jose').JWTVerifyGetKey }): Verifier`

- [ ] **Step 1: Write the failing test** — `cognito.verifier.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
    generateKeyPair,
    exportJWK,
    createLocalJWKSet,
    SignJWT,
} from 'jose';
import { makeVerifier } from './cognito.verifier.js';

const ISSUER = 'https://cognito-idp.us-east-1.amazonaws.com/pool_123';
const CLIENT_ID = 'client_abc';

async function setupCognito() {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const pubJwk = await exportJWK(publicKey);
    pubJwk.kid = 'test-key';
    pubJwk.alg = 'RS256';
    const jwks = createLocalJWKSet({ keys: [pubJwk] });
    const verify = makeVerifier({ mode: 'cognito', issuer: ISSUER, clientId: CLIENT_ID, jwks });

    const sign = (claims: Record<string, unknown>) =>
        new SignJWT(claims)
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience(CLIENT_ID)
            .setSubject('sub-1')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);

    return { verify, sign };
}

describe('makeVerifier (cognito)', () => {
    it('accepts a valid id token and returns identity', async () => {
        const { verify, sign } = await setupCognito();
        const token = await sign({ token_use: 'id', email: 'a@b.com', email_verified: true });
        await expect(verify(token)).resolves.toEqual({
            email: 'a@b.com',
            emailVerified: true,
            sub: 'sub-1',
        });
    });

    it('rejects an access token (token_use !== id)', async () => {
        const { verify, sign } = await setupCognito();
        const token = await sign({ token_use: 'access' });
        await expect(verify(token)).rejects.toThrow();
    });

    it('rejects a token with the wrong audience', async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const pubJwk = await exportJWK(publicKey);
        pubJwk.kid = 'test-key';
        pubJwk.alg = 'RS256';
        const jwks = createLocalJWKSet({ keys: [pubJwk] });
        const verify = makeVerifier({ mode: 'cognito', issuer: ISSUER, clientId: CLIENT_ID, jwks });
        const token = await new SignJWT({ token_use: 'id', email: 'a@b.com' })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience('some-other-client')
            .setSubject('sub-1')
            .setExpirationTime('5m')
            .sign(privateKey);
        await expect(verify(token)).rejects.toThrow();
    });
});

describe('makeVerifier (dev)', () => {
    const verify = makeVerifier({ mode: 'dev' });

    it('parses dev_<email>', async () => {
        await expect(verify('dev_alice@example.com')).resolves.toEqual({
            email: 'alice@example.com',
            emailVerified: true,
            sub: 'dev_alice@example.com',
        });
    });

    it('rejects a non-dev token', async () => {
        await expect(verify('garbage')).rejects.toThrow();
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- cognito.verifier`
Expected: FAIL — cannot find module `./cognito.verifier.js`.

- [ ] **Step 3: Implement** — `cognito.verifier.ts`

```ts
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type VerifiedIdentity = {
    email: string;
    emailVerified: boolean;
    sub: string;
};

export type Verifier = (token: string) => Promise<VerifiedIdentity>;

export const makeVerifier = (opts: {
    mode: 'dev' | 'cognito';
    issuer?: string;
    clientId?: string;
    jwks?: JWTVerifyGetKey;
}): Verifier => {
    if (opts.mode === 'dev') {
        return async (token: string) => {
            if (!token || !token.startsWith('dev_')) {
                throw new Error('invalid dev token');
            }
            const email = token.slice('dev_'.length);
            if (!email) throw new Error('invalid dev token');
            return { email, emailVerified: true, sub: `dev_${email}` };
        };
    }

    if (!opts.issuer || !opts.clientId) {
        throw new Error('cognito verifier requires issuer and clientId');
    }
    const issuer = opts.issuer;
    const clientId = opts.clientId;
    const jwks =
        opts.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

    return async (token: string) => {
        const { payload } = await jwtVerify(token, jwks, {
            issuer,
            audience: clientId,
        });
        if (payload.token_use !== 'id') {
            throw new Error('expected an id token');
        }
        const email = payload.email as string | undefined;
        if (!email) throw new Error('token missing email');
        return {
            email,
            emailVerified: payload.email_verified === true,
            sub: String(payload.sub),
        };
    };
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- cognito.verifier`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/cognito.verifier.ts src/lib/auth/cognito.verifier.test.ts
git commit -m "feat: add Cognito id-token verifier with dev-mode fallback"
```

---

### Task 3: Env vars + verifier instance wiring

**Files:**
- Modify: `server/src/config/env.ts` (add only — no removals yet)
- Create: `server/src/lib/auth/index.ts`
- Test: `server/src/lib/auth/index.test.ts`

**Interfaces:**
- Consumes: `makeVerifier`, `env`.
- Produces: `export const verifyToken: Verifier` (configured from env).

- [ ] **Step 1: Add the new env vars** — edit `env.ts`, add inside `server: { ... }` (leave the existing keys in place for now):

```ts
        AUTH_MODE: z.enum(['dev', 'cognito']),
        COGNITO_ISSUER: z.string().url().optional(),
        COGNITO_CLIENT_ID: z.string().optional(),
```

- [ ] **Step 2: Write the failing test** — `src/lib/auth/index.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
    NODE_ENV: 'test',
    ADMIN_API_KEY: '00000000-0000-0000-0000-000000000000',
    PORT: '3000',
    WEBSOCKET_PORT: '3001',
    DATABASE_URL: 'mongodb://localhost:27017',
    AWS_REGION: 'ap-south-1',
    CLIENT_URL: 'http://localhost:5173',
    SENTRY_DSN: 'https://abc@o0.ingest.sentry.io/0',
    NOTIFICATIONS_EMAIL: 'no-reply@example.com',
    JWT_SECRET: '00000000-0000-0000-0000-000000000000',
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('verifyToken instance', () => {
    it('verifies dev tokens when AUTH_MODE=dev', async () => {
        for (const [k, v] of Object.entries({ ...baseEnv, AUTH_MODE: 'dev' })) {
            vi.stubEnv(k, v);
        }
        const { verifyToken } = await import('./index.js');
        await expect(verifyToken('dev_x@y.com')).resolves.toMatchObject({ email: 'x@y.com' });
    });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- lib/auth/index`
Expected: FAIL — cannot find module `./index.js`.

- [ ] **Step 4: Implement** — `src/lib/auth/index.ts`

```ts
import env from '../../config/env.js';
import { makeVerifier, type Verifier } from './cognito.verifier.js';

export const verifyToken: Verifier = makeVerifier({
    mode: env.AUTH_MODE,
    issuer: env.COGNITO_ISSUER,
    clientId: env.COGNITO_CLIENT_ID,
});
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- lib/auth/index`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config/env.ts src/lib/auth/index.ts src/lib/auth/index.test.ts
git commit -m "feat: wire AUTH_MODE/COGNITO env + verifyToken instance"
```

---

### Task 4: User model (drop password) + JIT provisioning

**Files:**
- Modify: `server/src/features/user/user.model.ts` (remove `password` field)
- Modify: `server/src/features/user/user.repository.ts` (add `getOrCreateUserByEmail`)
- Modify: `server/src/features/user/user.service.ts` (add `getOrCreateUserByEmail`)
- Test: `server/src/features/user/user.repository.test.ts`

**Interfaces:**
- Consumes: `userModel`, `UserT`.
- Produces:
  - repository `getOrCreateUserByEmail({ email }: { email: string }): Promise<UserT>`
  - service `getOrCreateUserByEmail({ email }: { email: string }): Promise<UserT>`

- [ ] **Step 1: Remove `password` from the schema** — in `user.model.ts`, delete the `password` block so the schema is:

```ts
const userSchema = new Schema(
    {
        email: {
            type: String,
            unique: true,
            required: true,
        },
    },
    {
        timestamps: true,
        collection: userCollectionName,
    },
);
```

- [ ] **Step 2: Write the failing test** — `user.repository.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getOrCreateUserByEmail } from './user.repository.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'test' });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

describe('getOrCreateUserByEmail', () => {
    it('creates a user on first call and is idempotent', async () => {
        const first = await getOrCreateUserByEmail({ email: 'jit@example.com' });
        expect(first.email).toBe('jit@example.com');

        const second = await getOrCreateUserByEmail({ email: 'jit@example.com' });
        expect(second._id.toString()).toBe(first._id.toString());

        const count = await mongoose.connection
            .collection('users')
            .countDocuments({ email: 'jit@example.com' });
        expect(count).toBe(1);
    });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- user.repository`
Expected: FAIL — `getOrCreateUserByEmail` is not exported.

- [ ] **Step 4: Implement repository function** — in `user.repository.ts`, add (and export):

```ts
const getOrCreateUserByEmail = async ({
    email,
}: {
    email: string;
}): Promise<UserT> => {
    const user = await userModel.findOneAndUpdate(
        { email },
        { $setOnInsert: { email } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return user as UserT;
};
```

Update the `export { ... }` line to include `getOrCreateUserByEmail`.

- [ ] **Step 5: Add the service passthrough** — in `user.service.ts`, add:

```ts
const getOrCreateUserByEmail = async ({
    email,
}: {
    email: string;
}): Promise<UserT> => {
    return userDb.getOrCreateUserByEmail({ email });
};
```

Add `getOrCreateUserByEmail` to the `export { ... }` line.

- [ ] **Step 6: Run it to verify it passes**

Run: `npm test -- user.repository`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/user/user.model.ts src/features/user/user.repository.ts src/features/user/user.service.ts src/features/user/user.repository.test.ts
git commit -m "feat: drop password field, add JIT getOrCreateUserByEmail"
```

> Note: `user.service.ts` still imports bcrypt/otp/ses for the soon-to-be-deleted `createUser`/`changePassword`. That's fine — those are removed in Task 9. Build stays green.

---

### Task 5: `requireAuth` middleware

**Files:**
- Create: `server/src/middleware/auth.middleware.ts`
- Test: `server/src/middleware/auth.middleware.test.ts`

**Interfaces:**
- Consumes: `Verifier`, `UserT`, `AppError`, `verifyToken`, service `getOrCreateUserByEmail`.
- Produces:
  - `makeRequireAuth(deps: { verify: Verifier; getOrCreateUser: (a: { email: string }) => Promise<UserT> }): RequestHandler`
  - `export const requireAuth: RequestHandler` (env-wired instance)

- [ ] **Step 1: Write the failing test** — `auth.middleware.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { makeRequireAuth } from './auth.middleware.js';

const fakeUser = { _id: 'u1', email: 'a@b.com' } as any;

function run(mw: any, headers: Record<string, string>) {
    const req = { headers } as unknown as Request;
    const res = {} as Response;
    return new Promise<{ req: Request; err: any }>((resolve) => {
        mw(req, res, (err: any) => resolve({ req, err }));
    });
}

describe('makeRequireAuth', () => {
    it('attaches the user for a valid bearer token', async () => {
        const mw = makeRequireAuth({
            verify: vi.fn().mockResolvedValue({ email: 'a@b.com', emailVerified: true, sub: 's' }),
            getOrCreateUser: vi.fn().mockResolvedValue(fakeUser),
        });
        const { req, err } = await run(mw, { authorization: 'Bearer good' });
        expect(err).toBeUndefined();
        expect((req as any).user).toBe(fakeUser);
    });

    it('calls next with a 401 AppError when the header is missing', async () => {
        const mw = makeRequireAuth({
            verify: vi.fn(),
            getOrCreateUser: vi.fn(),
        });
        const { err } = await run(mw, {});
        expect(err.statusCode).toBe(401);
    });

    it('calls next with a 401 AppError when verification throws', async () => {
        const mw = makeRequireAuth({
            verify: vi.fn().mockRejectedValue(new Error('bad token')),
            getOrCreateUser: vi.fn(),
        });
        const { err } = await run(mw, { authorization: 'Bearer bad' });
        expect(err.statusCode).toBe(401);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- auth.middleware`
Expected: FAIL — cannot find module `./auth.middleware.js`.

- [ ] **Step 3: Implement** — `auth.middleware.ts`

```ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { AppError } from '../errorHandler/error.interface.js';
import type { Verifier } from '../lib/auth/cognito.verifier.js';
import { verifyToken } from '../lib/auth/index.js';
import type { UserT } from '../features/user/user.model.js';
import * as userService from '../features/user/user.service.js';

type Deps = {
    verify: Verifier;
    getOrCreateUser: (args: { email: string }) => Promise<UserT>;
};

const unauthorized = (messageForSentry: string) =>
    new AppError({
        messageForSentry,
        errorMessageForClient: ReasonPhrases.UNAUTHORIZED,
        statusCode: StatusCodes.UNAUTHORIZED,
    });

export const makeRequireAuth =
    ({ verify, getOrCreateUser }: Deps): RequestHandler =>
    async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const header = req.headers.authorization ?? '';
            const [scheme, token] = header.split(' ');
            if (scheme !== 'Bearer' || !token) {
                return next(unauthorized('missing bearer token'));
            }
            const identity = await verify(token);
            req.user = await getOrCreateUser({ email: identity.email });
            return next();
        } catch (e) {
            return next(unauthorized(e instanceof Error ? e.message : 'auth failed'));
        }
    };

export const requireAuth: RequestHandler = makeRequireAuth({
    verify: verifyToken,
    getOrCreateUser: userService.getOrCreateUserByEmail,
});
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- auth.middleware`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/auth.middleware.ts src/middleware/auth.middleware.test.ts
git commit -m "feat: add requireAuth middleware (Cognito/dev verify + JIT)"
```

---

### Task 6: Socket.io handshake auth (factory)

**Files:**
- Create: `server/src/features/socket/auth.ts`
- Test: `server/src/features/socket/auth.test.ts`

**Interfaces:**
- Consumes: `Verifier`, `UserT`.
- Produces: `makeSocketAuth(deps: { verify: Verifier; getOrCreateUser: (a: { email: string }) => Promise<UserT> }): (socket: any, next: (err?: Error) => void) => Promise<void>`

- [ ] **Step 1: Write the failing test** — `auth.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { makeSocketAuth } from './auth.js';

const fakeUser = { _id: 'u1', email: 'a@b.com' } as any;

function fakeSocket(token?: string) {
    return { handshake: { auth: token ? { token } : {} }, request: {} as any };
}

describe('makeSocketAuth', () => {
    it('attaches user to socket.request on a valid token', async () => {
        const mw = makeSocketAuth({
            verify: vi.fn().mockResolvedValue({ email: 'a@b.com', emailVerified: true, sub: 's' }),
            getOrCreateUser: vi.fn().mockResolvedValue(fakeUser),
        });
        const socket = fakeSocket('good');
        const next = vi.fn();
        await mw(socket as any, next);
        expect(socket.request.user).toBe(fakeUser);
        expect(next).toHaveBeenCalledWith();
    });

    it('calls next with an error when the token is missing', async () => {
        const mw = makeSocketAuth({ verify: vi.fn(), getOrCreateUser: vi.fn() });
        const next = vi.fn();
        await mw(fakeSocket() as any, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- features/socket/auth`
Expected: FAIL — cannot find module `./auth.js`.

- [ ] **Step 3: Implement** — `src/features/socket/auth.ts`

```ts
import type { Verifier } from '../../lib/auth/cognito.verifier.js';
import type { UserT } from '../user/user.model.js';

type Deps = {
    verify: Verifier;
    getOrCreateUser: (args: { email: string }) => Promise<UserT>;
};

export const makeSocketAuth =
    ({ verify, getOrCreateUser }: Deps) =>
    async (socket: any, next: (err?: Error) => void): Promise<void> => {
        try {
            const token: string | undefined = socket.handshake?.auth?.token;
            if (!token) throw new Error('missing token');
            const identity = await verify(token);
            socket.request.user = await getOrCreateUser({ email: identity.email });
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    };
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- features/socket/auth`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/socket/auth.ts src/features/socket/auth.test.ts
git commit -m "feat: add socket.io handshake auth factory"
```

---

### Task 7: Port merge — single HTTP server + socket.io attach

**Files:**
- Modify: `server/src/features/socket/index.ts` (remove own http server/listen; add `io.use` auth; drop `WEBSOCKET_PORT`)
- Modify: `server/src/index.ts` (create http server, `io.attach`, listen on PORT)
- Modify: `server/src/config/env.ts` (remove `WEBSOCKET_PORT`)

**Interfaces:**
- Consumes: `makeSocketAuth`, `verifyToken`, service `getOrCreateUserByEmail`, `io`.
- Produces: `export { io }` (unchanged signature, still consumed by `message.service`).

- [ ] **Step 1: Rewrite `src/features/socket/index.ts`** to attach-mode (no standalone server, no `listen`):

```ts
import { Server } from 'socket.io';

import { corsList } from '../../constants.js';
import * as chatService from '../chat/chat.service.js';
import { makeSocketAuth } from './auth.js';
import { verifyToken } from '../../lib/auth/index.js';
import * as userService from '../user/user.service.js';

const io = new Server({
    cors: { origin: corsList, methods: ['GET', 'POST'] },
});

io.use(
    makeSocketAuth({
        verify: verifyToken,
        getOrCreateUser: userService.getOrCreateUserByEmail,
    }),
);

io.on('connection', (socket) => {
    const userId = (socket.request as any).user?.email;
    console.log(`${userId} user connected`);

    socket.on('disconnect', () => console.log(`${userId} user disconnected`));

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

export { io };
```

- [ ] **Step 2: Update `src/index.ts`** — add the http import at the top with the other imports:

```ts
import http from 'http';
```

and add (with the other feature imports) an explicit import so `io` is created before attach:

```ts
import { io } from './features/socket/index.js';
```

Then replace the final `app.listen(...)` block with:

```ts
const server = http.createServer(app);
io.attach(server);

server.listen(env.PORT, () => {
    console.log(`server running on PORT: ${env.PORT}`);
});
```

- [ ] **Step 3: Remove `WEBSOCKET_PORT` from `env.ts`** — delete the line:

```ts
        WEBSOCKET_PORT: z.coerce.number().min(0).max(9999),
```

- [ ] **Step 4: Typecheck + run the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests PASS.

- [ ] **Step 5: Smoke-check the merged server boots** (dev mode, no real Cognito/DB needed for boot of the HTTP listener — point DATABASE_URL at the in-memory test mongo is overkill; just confirm it compiles and the listener wiring is correct via the build):

Run: `npm run build`
Expected: `build/` emitted with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/socket/index.ts src/index.ts src/config/env.ts
git commit -m "refactor: merge socket.io onto single HTTP server, drop WEBSOCKET_PORT"
```

---

### Task 8: Rewire routes to `requireAuth`; remove login/create routes

**Files:**
- Modify: `server/src/features/user/user.route.ts`
- Modify: `server/src/features/message/message.route.ts`
- Modify: `server/src/features/user/user.controller.ts` (drop `createUser`)
- Modify: `server/src/index.ts` (drop `/auth` mount + `passport.initialize()`)
- Test: `server/src/features/__tests__/protected-route.test.ts`

**Interfaces:**
- Consumes: `requireAuth`.
- Produces: protected routes that return 401 without a valid token.

- [ ] **Step 1: Write the failing integration test** — `src/features/__tests__/protected-route.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { requireAuth } from '../../middleware/auth.middleware.js';

// A tiny app that mounts only the middleware under test.
const app = express();
app.get('/protected', requireAuth, (req, res) => {
    res.json({ email: (req as any).user.email });
});
app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode ?? 500).json({ error: err.errorMessageForClient });
});

let mongod: MongoMemoryServer;
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'test' });
});
afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

describe('requireAuth on a protected route (dev mode)', () => {
    it('401 without a token', async () => {
        await request(app).get('/protected').expect(401);
    });

    it('200 and JIT user with a dev token', async () => {
        const res = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer dev_smoke@example.com')
            .expect(200);
        expect(res.body.email).toBe('smoke@example.com');
    });
});
```

> This test imports `requireAuth`, which transitively imports `env`. Ensure the test process has `AUTH_MODE=dev` and the other required env vars set. Add a setup file:

- [ ] **Step 2: Add a vitest setup file that stubs env** — create `server/src/__tests__/setup.ts`:

```ts
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'dev';
process.env.ADMIN_API_KEY = '00000000-0000-0000-0000-000000000000';
process.env.PORT = '3000';
process.env.DATABASE_URL = 'mongodb://localhost:27017';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.SENTRY_DSN = 'https://abc@o0.ingest.sentry.io/0';
```

and register it in `vitest.config.ts`:

```ts
        setupFiles: ['src/__tests__/setup.ts'],
```

(add inside the existing `test: { ... }` object).

> Note: `env.ts` still declares `AWS_REGION`, `NOTIFICATIONS_EMAIL`, `JWT_SECRET` as required until Task 9. Until then, also set them in `setup.ts`:
> ```ts
> process.env.AWS_REGION = 'ap-south-1';
> process.env.NOTIFICATIONS_EMAIL = 'no-reply@example.com';
> process.env.JWT_SECRET = '00000000-0000-0000-0000-000000000000';
> ```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- protected-route`
Expected: FAIL — route returns 200 currently? No — `requireAuth` already exists; the test should actually PASS once env is set. If it fails, it's due to env wiring. Fix env/setup until both assertions pass. (This task's "failing" state is the routes still using `authJwtMW`; the dedicated test validates `requireAuth` directly and gates the rewire.)

- [ ] **Step 4: Swap `authJwtMW` → `requireAuth` in `user.route.ts`** — replace the import:

```ts
import { requireAuth } from '../../middleware/auth.middleware.js';
```

remove the `/create` route and its validator usage, leaving:

```ts
const router = Router();

router.post('/search', requireAuth, searchUsersValidatorMW, userController.searchUsers);

router.get('/details', requireAuth, userController.getUser);

export default router;
```

(Drop the now-unused `createUserValidator` import and `createUserValidatorMW`.)

- [ ] **Step 5: Swap `authJwtMW` → `requireAuth` in `message.route.ts`** — replace the import line `import { authJwtMW } from '../../lib/passport/index.js';` with:

```ts
import { requireAuth } from '../../middleware/auth.middleware.js';
```

and replace both `authJwtMW` usages with `requireAuth`.

- [ ] **Step 6: Drop `createUser` from `user.controller.ts`** — remove the `createUser` handler and its export (keep `searchUsers`, `getUser`).

- [ ] **Step 7: Update `index.ts`** — remove the auth router:
  - delete `import authRouter from './features/auth/auth.route.js';`
  - delete `app.use('/auth', authRouter);`
  - delete `import passport from 'passport';` and `app.use(passport.initialize());`

- [ ] **Step 8: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests PASS (protected-route 401 + 200).

- [ ] **Step 9: Commit**

```bash
git add src/features/user/user.route.ts src/features/message/message.route.ts src/features/user/user.controller.ts src/index.ts src/__tests__/setup.ts vitest.config.ts src/features/__tests__/protected-route.test.ts
git commit -m "feat: protect routes with requireAuth; remove login/create routes + passport init"
```

---

### Task 9: Delete dead code, trim deps, finalize env + CORS

**Files:**
- Delete: `server/src/features/auth/` (`auth.route.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.validator.ts`, `otp.model.ts`, `otp.repository.ts`)
- Delete: `server/src/lib/passport/`, `server/src/lib/bcrypt/`, `server/src/lib/ses/`
- Modify: `server/src/features/user/user.service.ts` (remove `createUser`, `changePassword`, `getUserById` + their imports)
- Modify: `server/src/features/user/user.repository.ts` (remove `createUser`, `changePassword`, `getUserById`)
- Modify: `server/src/config/env.ts` (remove `AWS_REGION`, `NOTIFICATIONS_EMAIL`, `JWT_SECRET`)
- Modify: `server/src/constants.ts` (CORS origins)
- Modify: `server/src/__tests__/setup.ts` (drop the now-removed env vars)
- Modify: `server/package.json` (dependency trim)

**Interfaces:**
- Consumes: nothing new.
- Produces: a clean build with no references to removed modules.

- [ ] **Step 1: Trim `user.service.ts`** — remove `createUser`, `changePassword`, `getUserById` and the now-unused imports (`otpDb`, `env`, `generatePassword`, `hashPassword`, `sendMail`, `getDateAfterNDays`, `Types`). Keep `getUserByEmail`, `searchUsers`, `getOrCreateUserByEmail`, and the `AppError`/`ReasonPhrases`/`StatusCodes` imports used by `getUserByEmail`. Final exports:

```ts
export { getUserByEmail, searchUsers, getOrCreateUserByEmail };
```

- [ ] **Step 2: Trim `user.repository.ts`** — remove `createUser`, `changePassword`, `getUserById` and the unused `Types`/`UserDataT` imports. Final exports:

```ts
export { getUserByEmail, searchUsers, getOrCreateUserByEmail };
```

- [ ] **Step 3: Delete dead directories/files**

```bash
git rm -r src/features/auth src/lib/passport src/lib/bcrypt src/lib/ses
```

- [ ] **Step 4: Remove dead env vars** — in `env.ts`, delete `AWS_REGION`, `NOTIFICATIONS_EMAIL`, `JWT_SECRET`. Final `server` block keys: `NODE_ENV`, `ADMIN_API_KEY`, `PORT`, `DATABASE_URL`, `CLIENT_URL`, `SENTRY_DSN`, `AUTH_MODE`, `COGNITO_ISSUER`, `COGNITO_CLIENT_ID`.

- [ ] **Step 5: Update `setup.ts`** — delete the `AWS_REGION`, `NOTIFICATIONS_EMAIL`, `JWT_SECRET` lines added in Task 8.

- [ ] **Step 6: Update CORS** — replace `src/constants.ts` body with:

```ts
import env from './config/env.js';

const corsList = [
    env.NODE_ENV === 'prod'
        ? 'https://chat.murugappan.dev'
        : /^http[s]?:\/\/localhost:\d{4}$/,
];

export { corsList };
```

- [ ] **Step 7: Trim `package.json` dependencies**

```bash
npm uninstall bcrypt passport passport-jwt passport-local jsonwebtoken nodemailer @aws-sdk/client-sesv2 @types/bcrypt @types/passport-jwt @types/passport-local @types/nodemailer
```

- [ ] **Step 8: Typecheck, test, build — the dangling-import gate**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean (no references to deleted modules), all tests PASS, `build/` emitted.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove OTP/bcrypt/passport/SES, trim deps, finalize env + CORS"
```

---

## Self-Review

**Spec coverage:**
- §1 AuthStack app client → cross-repo, explicitly **out of this plan's scope** (eventform repo); flagged below.
- §2 AUTH_MODE/COGNITO env → Task 3 (add) + Task 9 (remove old). ✓
- §3 id-token verifier → Task 2. ✓
- §4 requireAuth → Task 5; route wiring → Task 8. ✓
- §5 socket handshake → Task 6 (factory) + Task 7 (wire). ✓
- §6 JIT provisioning → Task 4. ✓
- §7 port merge → Task 7. ✓
- §8 removals + dep trim → Task 9. ✓
- §9 CORS → Task 9 Step 6. ✓
- Testing (local JWKS, dev token, JIT idempotency, 401) → Tasks 2, 4, 5, 8. ✓

**Placeholder scan:** no TBD/TODO; every code step has full code. ✓

**Type consistency:** `Verifier`, `VerifiedIdentity`, `getOrCreateUserByEmail({ email })`, `makeRequireAuth`, `makeSocketAuth`, `verifyToken` names are consistent across Tasks 2→3→4→5→6→7→8. ✓

## Not in this plan (handled elsewhere)

- **eventform AuthStack app client** (spec §1) — a cross-repo CDK change made in the eventform repo; it produces the pool id + client id consumed at deploy time. Tracked in the spec's "Open items".
- The actual `COGNITO_ISSUER`/`COGNITO_CLIENT_ID` values, the `.env` for the box, and prod CORS confirmation arrive with Sub-projects 2–4.
