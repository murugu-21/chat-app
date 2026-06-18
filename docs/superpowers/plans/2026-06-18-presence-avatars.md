# Presence + Persisted Avatars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time online/offline presence and profile avatars (persisted from OAuth, shown for you and peers) to the chat app.

**Architecture:** On login the verified id-token `picture` is stored as `User.avatarUrl` (JIT upsert). `chat/list` is enriched with each peer's `avatarUrl`. Presence is an in-memory connection-count registry on the single backend instance, broadcast over an app-level socket; the client keeps a presence set and renders dots + a `UserAvatar` (stored URL → Gravatar → initials).

**Tech Stack:** Express + socket.io + mongoose (server), React 19 + react-router + shadcn (client), vitest + mongodb-memory-server (tests).

## Global Constraints

- **Presentation/behavior:** don't change SWR keys (`chat/list`, `user/search`, `chat/create`, `message/list/:id`, `message/send`), the `message`/`join`/`leave` socket events, `fetcher`, PKCE auth, or the auth/health wrappers — only extend them as specified.
- **Avatar precedence:** stored `avatarUrl` → `Gravatar(email)` → initials. Peers' `avatarUrl` comes from `chat/list`; yours from the id-token `picture`.
- **Avatar refresh:** `getOrCreateUserByEmail` stores `avatarUrl` on insert and refreshes it on every login when a picture is present; never clears it (dev tokens omit `picture`).
- **Presence:** binary; in-memory `Map<email, connectionCount>` (single instance, ASG `maxCapacity: 1`); offline only on the last-connection 1→0 transition. Socket events: `presence:state` (string[] snapshot to the connecting socket) and `presence:update` (`{ email: string, online: boolean }` broadcast).
- **Socket:** one app-level socket via `SocketProvider` (mounted in `ChatLayout`); `useSocket()` reads it. ESM/NodeNext on the server (`.js` import suffixes); `@/` alias on the client.
- Keep commits green: server `npx tsc --noEmit` + `npm test`; client `npm run build` + `npm run lint`.
- Server commands run from `server/`, client from `app/`.

---

### Task 1: Persist avatarUrl on login (model + verifier + JIT upsert)

**Files:**
- Modify: `server/src/features/user/user.model.ts` (add `avatarUrl`)
- Modify: `server/src/lib/auth/cognito.verifier.ts` (extract `picture`)
- Modify: `server/src/features/user/user.repository.ts` + `user.service.ts` (`getOrCreateUserByEmail` takes `avatarUrl`)
- Test: `server/src/lib/auth/cognito.verifier.test.ts`, `server/src/features/user/user.repository.test.ts`

**Interfaces:**
- Produces: `VerifiedIdentity` gains `picture?: string`; `getOrCreateUserByEmail({ email: string; avatarUrl?: string }): Promise<UserT>`.

- [ ] **Step 1: Add `avatarUrl` to the user schema** — in `user.model.ts`, add to the schema fields (after `email`):

```ts
        avatarUrl: {
            type: String,
            required: false,
        },
```

- [ ] **Step 2: Failing test — verifier extracts `picture`** — add to `cognito.verifier.test.ts` inside `describe('makeVerifier (cognito)', …)`:

```ts
    it('returns the picture claim when present', async () => {
        const { verify, sign } = await setupCognito();
        const token = await sign({ token_use: 'id', email: 'a@b.com', email_verified: true, picture: 'https://pic/x.png' });
        await expect(verify(token)).resolves.toMatchObject({ email: 'a@b.com', picture: 'https://pic/x.png' });
    });
```

- [ ] **Step 3: Run (RED)** — `npm test -- cognito.verifier` → fails (`picture` undefined).

- [ ] **Step 4: Implement** — in `cognito.verifier.ts`, extend the cognito-mode return; and add `picture` to the dev-mode return as `undefined`:

```ts
        return {
            email,
            emailVerified: payload.email_verified === true,
            sub: payload.sub,
            picture: typeof payload.picture === 'string' ? payload.picture : undefined,
        };
```
Update the `VerifiedIdentity` type to include `picture?: string`, and the dev-mode branch to return `picture: undefined` (so the shape is uniform).

- [ ] **Step 5: Run (GREEN)** — `npm test -- cognito.verifier` → passes.

- [ ] **Step 6: Failing test — `getOrCreateUserByEmail` stores + refreshes avatarUrl** — add to `user.repository.test.ts`:

```ts
    it('stores avatarUrl on insert and refreshes it on update', async () => {
        const a = await getOrCreateUserByEmail({ email: 'av@example.com', avatarUrl: 'https://pic/1.png' });
        expect(a.avatarUrl).toBe('https://pic/1.png');
        const b = await getOrCreateUserByEmail({ email: 'av@example.com', avatarUrl: 'https://pic/2.png' });
        expect(b._id.toString()).toBe(a._id.toString());
        expect(b.avatarUrl).toBe('https://pic/2.png'); // refreshed
        const c = await getOrCreateUserByEmail({ email: 'av@example.com' }); // no picture (dev token)
        expect(c.avatarUrl).toBe('https://pic/2.png'); // not cleared
    });
```

- [ ] **Step 7: Run (RED)** — `npm test -- user.repository` → fails (signature/behavior).

- [ ] **Step 8: Implement** — `user.repository.ts` `getOrCreateUserByEmail`:

```ts
const getOrCreateUserByEmail = async ({
    email,
    avatarUrl,
}: {
    email: string;
    avatarUrl?: string;
}): Promise<UserT> => {
    const user = await userModel.findOneAndUpdate(
        { email },
        {
            ...(avatarUrl ? { $set: { avatarUrl } } : {}),
            $setOnInsert: { email },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return user as UserT;
};
```
And `user.service.ts` passthrough:
```ts
const getOrCreateUserByEmail = async ({
    email,
    avatarUrl,
}: {
    email: string;
    avatarUrl?: string;
}): Promise<UserT> => {
    return userDb.getOrCreateUserByEmail({ email, avatarUrl });
};
```

- [ ] **Step 9: Run (GREEN) + full gate** — `npm test && npx tsc --noEmit` → all pass, tsc clean.

- [ ] **Step 10: Commit**

```bash
git add src/features/user/user.model.ts src/lib/auth/cognito.verifier.ts src/lib/auth/cognito.verifier.test.ts src/features/user/user.repository.ts src/features/user/user.service.ts src/features/user/user.repository.test.ts
git commit -m "feat: persist OAuth avatarUrl on login (verifier picture + JIT upsert)"
```

---

### Task 2: Thread `picture` through requireAuth + socket auth

**Files:**
- Modify: `server/src/middleware/auth.middleware.ts`
- Modify: `server/src/features/socket/auth.ts`
- Test: `server/src/middleware/auth.middleware.test.ts`, `server/src/features/socket/auth.test.ts`

**Interfaces:**
- Consumes: `VerifiedIdentity.picture`, `getOrCreateUserByEmail({email, avatarUrl})`.

- [ ] **Step 1: Update `auth.middleware.ts`** — widen the `Deps.getOrCreateUser` signature and pass `avatarUrl`:

```ts
type Deps = {
    verify: Verifier;
    getOrCreateUser: (args: { email: string; avatarUrl?: string }) => Promise<UserT>;
};
```
and in the handler:
```ts
            const identity = await verify(token);
            req.user = await getOrCreateUser({ email: identity.email, avatarUrl: identity.picture });
```

- [ ] **Step 2: Update `features/socket/auth.ts`** — same `Deps` widening and call:

```ts
type Deps = {
    verify: Verifier;
    getOrCreateUser: (args: { email: string; avatarUrl?: string }) => Promise<UserT>;
};
```
```ts
            const identity = await verify(token);
            socket.request.user = await getOrCreateUser({ email: identity.email });
```
→ change to:
```ts
            socket.request.user = await getOrCreateUser({ email: identity.email, avatarUrl: identity.picture });
```

- [ ] **Step 3: Strengthen the success-path tests** — in `auth.middleware.test.ts`, the valid-token test's `verify` fake should resolve `{ email: 'a@b.com', emailVerified: true, sub: 's', picture: 'https://pic/x.png' }`, and assert `getOrCreateUser` was called with `{ email: 'a@b.com', avatarUrl: 'https://pic/x.png' }`. Do the same in `socket/auth.test.ts`.

- [ ] **Step 4: Gate** — `npm test && npx tsc --noEmit` → green.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/auth.middleware.ts src/middleware/auth.middleware.test.ts src/features/socket/auth.ts src/features/socket/auth.test.ts
git commit -m "feat: pass OAuth picture into JIT user provisioning (http + socket)"
```

---

### Task 3: Enrich `chat/list` with peer avatarUrl

**Files:**
- Modify: `server/src/features/user/user.repository.ts` + `user.service.ts` (`getUsersByEmails`)
- Modify: `server/src/features/chat/chat.service.ts` (`listChatsOfUser` enrichment)
- Test: `server/src/features/chat/chat.service.test.ts` (new)

**Interfaces:**
- Produces: `getUsersByEmails(emails: string[]): Promise<Array<Pick<UserT, 'email' | 'avatarUrl'>>>`; `listChatsOfUser` returns `Array<ChatT & { avatarUrl?: string }>`.

- [ ] **Step 1: Add `getUsersByEmails`** to `user.repository.ts`:

```ts
const getUsersByEmails = async (
    emails: string[],
): Promise<Array<Pick<UserT, 'email' | 'avatarUrl'>>> => {
    if (emails.length === 0) return [];
    const users = await userModel
        .find({ email: { $in: emails } }, { _id: 0, email: 1, avatarUrl: 1 })
        .lean();
    return users as Array<Pick<UserT, 'email' | 'avatarUrl'>>;
};
```
Add it to the repository `export { … }` line and add a passthrough in `user.service.ts`:
```ts
const getUsersByEmails = async (emails: string[]) => userDb.getUsersByEmails(emails);
```
(add to the service export line).

- [ ] **Step 2: Failing test — `listChatsOfUser` maps peer avatarUrl** — `chat.service.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { userModel } from '../user/user.model.js';
import { chatModel } from './chat.model.js';
import { listChatsOfUser } from './chat.service.js';

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri(), { dbName: 'test' }); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });

describe('listChatsOfUser enrichment', () => {
    it('attaches each peer user\'s avatarUrl by chatName', async () => {
        const me = await userModel.create({ email: 'me@x.com' });
        await userModel.create({ email: 'peer@x.com', avatarUrl: 'https://pic/peer.png' });
        await chatModel.create({ userId: me._id, chatId: 'c1', chatName: 'peer@x.com' });
        const chats = await listChatsOfUser(me._id.toString());
        expect(chats).toHaveLength(1);
        expect(chats[0].chatName).toBe('peer@x.com');
        expect(chats[0].avatarUrl).toBe('https://pic/peer.png');
    });
});
```

- [ ] **Step 3: Run (RED)** — `npm test -- chat.service` → fails (`avatarUrl` undefined / not a property).

- [ ] **Step 4: Implement enrichment** — in `chat.service.ts`, replace `listChatsOfUser`:

```ts
const listChatsOfUser = async (
    userId: string,
): Promise<Array<ChatT & { avatarUrl?: string }>> => {
    const chats = await chatDb.listChatsOfUser(userId);
    const peers = await userService.getUsersByEmails(chats.map((c) => c.chatName));
    const avatarByEmail = new Map(peers.map((p) => [p.email, p.avatarUrl]));
    return chats.map((c) => ({
        ...(c.toObject ? c.toObject() : c),
        avatarUrl: avatarByEmail.get(c.chatName) ?? undefined,
    }));
};
```
> Note: `chatDb.listChatsOfUser` returns hydrated docs (`.find({userId})` without `.lean()`); spread `c.toObject()` so the avatarUrl merges onto a plain object. If you prefer, change the repo `find` to `.lean()` and spread `c` directly — pick one and keep the return type `ChatT & { avatarUrl?: string }`.

- [ ] **Step 5: Run (GREEN) + gate** — `npm test -- chat.service && npx tsc --noEmit` → pass, clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/user/user.repository.ts src/features/user/user.service.ts src/features/chat/chat.service.ts src/features/chat/chat.service.test.ts
git commit -m "feat: enrich chat/list with each peer's avatarUrl"
```

---

### Task 4: Presence registry (in-memory, pure)

**Files:**
- Create: `server/src/features/presence/presence.ts`
- Test: `server/src/features/presence/presence.test.ts`

**Interfaces:**
- Produces: `addConnection(email): boolean`, `removeConnection(email): boolean`, `onlineEmails(): string[]`, `isOnline(email): boolean`.

- [ ] **Step 1: Failing test** — `presence.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { addConnection, removeConnection, onlineEmails, isOnline, __reset } from './presence.js';

describe('presence registry', () => {
    beforeEach(() => __reset());
    it('first connection marks online (0->1 returns true)', () => {
        expect(addConnection('a@x.com')).toBe(true);
        expect(isOnline('a@x.com')).toBe(true);
        expect(onlineEmails()).toEqual(['a@x.com']);
    });
    it('second connection does not re-signal online', () => {
        addConnection('a@x.com');
        expect(addConnection('a@x.com')).toBe(false); // already online
    });
    it('offline only when the last connection drops', () => {
        addConnection('a@x.com'); addConnection('a@x.com');
        expect(removeConnection('a@x.com')).toBe(false); // still 1 left
        expect(isOnline('a@x.com')).toBe(true);
        expect(removeConnection('a@x.com')).toBe(true); // last one -> offline
        expect(isOnline('a@x.com')).toBe(false);
        expect(onlineEmails()).toEqual([]);
    });
    it('removing an unknown email is a no-op', () => {
        expect(removeConnection('ghost@x.com')).toBe(false);
    });
});
```

- [ ] **Step 2: Run (RED)** — `npm test -- presence` → fails (no module).

- [ ] **Step 3: Implement** — `presence.ts`:

```ts
// In-memory presence: email -> active socket connection count. Single-instance
// only (ASG maxCapacity=1); see the spec's "Scaling" note for the Redis path.
const counts = new Map<string, number>();

export const addConnection = (email: string): boolean => {
    const next = (counts.get(email) ?? 0) + 1;
    counts.set(email, next);
    return next === 1; // true on 0 -> 1 (just came online)
};

export const removeConnection = (email: string): boolean => {
    const current = counts.get(email) ?? 0;
    if (current <= 0) return false;
    if (current === 1) {
        counts.delete(email);
        return true; // 1 -> 0 (just went offline)
    }
    counts.set(email, current - 1);
    return false;
};

export const onlineEmails = (): string[] => [...counts.keys()];
export const isOnline = (email: string): boolean => (counts.get(email) ?? 0) > 0;

// test-only reset
export const __reset = (): void => counts.clear();
```

- [ ] **Step 4: Run (GREEN)** — `npm test -- presence` → 4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/presence/presence.ts src/features/presence/presence.test.ts
git commit -m "feat: in-memory presence registry (connection-counted)"
```

---

### Task 5: Broadcast presence over the socket

**Files:**
- Modify: `server/src/features/socket/index.ts`

- [ ] **Step 1: Wire presence into the connection handler** — in `socket/index.ts`, import the registry and replace the `console.log` connect/disconnect lines:

```ts
import { addConnection, removeConnection, onlineEmails } from '../presence/presence.js';
```
Inside `io.on('connection', (socket) => { ... })`, replace the two console.log lines with:
```ts
    const email = (socket.request as any).user?.email as string | undefined;
    if (email) {
        const wentOnline = addConnection(email);
        socket.emit('presence:state', onlineEmails());
        if (wentOnline) socket.broadcast.emit('presence:update', { email, online: true });
    }

    socket.on('disconnect', () => {
        if (email && removeConnection(email)) {
            io.emit('presence:update', { email, online: false });
        }
    });
```
(Keep the existing `join`/`leave`/message handlers unchanged.)

- [ ] **Step 2: Gate** — `npx tsc --noEmit && npm test && npm run build` → all green (presence registry tests already cover the logic; this wiring is exercised manually).

- [ ] **Step 3: Commit**

```bash
git add src/features/socket/index.ts
git commit -m "feat: emit presence:state on connect and presence:update on change"
```

---

### Task 6: App-level SocketProvider + usePresence (client)

**Files:**
- Create: `app/src/components/socket/SocketProvider.tsx`
- Modify: `app/src/hooks/useSocket.tsx` (read context)
- Modify: `app/src/layouts/ChatLayout.tsx` (wrap)

**Interfaces:**
- Produces: `useSocket(): { socket: Socket }`, `usePresence(): { isOnline: (email: string) => boolean }`.

- [ ] **Step 1: Create `SocketProvider.tsx`** — one socket for the session + presence state:

```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BACKEND_URL } from '../../env';
import { getToken } from '../../lib/auth';

type Ctx = { socket: Socket; isOnline: (email: string) => boolean };
const SocketContext = createContext<Ctx | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
    const socketRef = useRef<Socket | null>(null);
    if (!socketRef.current) {
        socketRef.current = io(BACKEND_URL, { autoConnect: false, auth: (cb) => cb({ token: getToken() }) });
    }
    const socket = socketRef.current;
    const [online, setOnline] = useState<Set<string>>(new Set());

    useEffect(() => {
        const onState = (emails: string[]) => setOnline(new Set(emails));
        const onUpdate = ({ email, online: isUp }: { email: string; online: boolean }) =>
            setOnline((prev) => {
                const next = new Set(prev);
                if (isUp) next.add(email); else next.delete(email);
                return next;
            });
        socket.on('presence:state', onState);
        socket.on('presence:update', onUpdate);
        socket.connect();
        return () => {
            socket.off('presence:state', onState);
            socket.off('presence:update', onUpdate);
            socket.disconnect();
        };
    }, [socket]);

    const isOnline = (email: string) => online.has(email);
    return <SocketContext.Provider value={{ socket, isOnline }}>{children}</SocketContext.Provider>;
}

export function useSocketCtx(): Ctx {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocketCtx must be used within SocketProvider');
    return ctx;
}

export function usePresence() {
    return { isOnline: useSocketCtx().isOnline };
}
```

- [ ] **Step 2: Refactor `useSocket.tsx`** to read the context (no own socket):

```tsx
import { useSocketCtx } from '@/components/socket/SocketProvider';

export function useSocket() {
    return { socket: useSocketCtx().socket };
}
```

- [ ] **Step 3: Mount the provider in `ChatLayout.tsx`** — wrap the layout's content:

```tsx
import { Outlet, useParams } from 'react-router';
import { Sidebar } from '@/components/chat/Sidebar';
import { SocketProvider } from '@/components/socket/SocketProvider';
import { cn } from '@/lib/utils';

export default function ChatLayout() {
    const { chatId } = useParams();
    return (
        <SocketProvider>
            <div className="flex h-screen w-full overflow-hidden">
                <div className={cn('w-full md:w-80 md:block', chatId && 'hidden md:block')}>
                    <Sidebar />
                </div>
                <main className={cn('flex-1 flex-col overflow-hidden', chatId ? 'flex' : 'hidden md:flex')}>
                    <Outlet />
                </main>
            </div>
        </SocketProvider>
    );
}
```
(Adjust to match the current `ChatLayout` markup; the only change is wrapping in `<SocketProvider>`.)

- [ ] **Step 4: Gate** — `npm run build && npm run lint && npm test` → green. Visually: open a chat → messages still send/receive (now via the shared socket).

- [ ] **Step 5: Commit**

```bash
git add src/components/socket/SocketProvider.tsx src/hooks/useSocket.tsx src/layouts/ChatLayout.tsx
git commit -m "feat: app-level SocketProvider (shared socket) + usePresence"
```

---

### Task 7: UserAvatar + Gravatar + own picture (client)

**Files:**
- Modify: `app/src/lib/auth.ts` (`pictureFromIdToken`, store `chat.picture`, `getPicture`)
- Modify: `app/src/pages/AuthCallback.tsx` (store picture)
- Create: `app/src/lib/gravatar.ts`
- Create: `app/src/components/PresenceDot.tsx`, `app/src/components/UserAvatar.tsx`

**Interfaces:**
- Produces: `getPicture(): string | null`, `gravatarUrl(email): Promise<string>`, `<UserAvatar email src? online? className?/>`, `<PresenceDot online/>`.

- [ ] **Step 1: `lib/auth.ts`** — add picture storage. Add a key + helpers, and store picture in `storeTokens`:

```ts
const PICTURE_KEY = 'chat.picture';
```
Extend `storeTokens` to accept + store a picture, and add getters/decoder:
```ts
export const storeTokens = (idToken: string, refreshToken?: string, email?: string, picture?: string): void => {
    localStorage.setItem(TOKEN_KEY, idToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (email) localStorage.setItem(EMAIL_KEY, email);
    if (picture) localStorage.setItem(PICTURE_KEY, picture);
};
export const getPicture = (): string | null => localStorage.getItem(PICTURE_KEY);
export const pictureFromIdToken = (idToken: string): string | undefined => {
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return typeof payload.picture === 'string' ? payload.picture : undefined;
    } catch {
        return undefined;
    }
};
```
Also add `PICTURE_KEY` removal to `clearTokens`.

- [ ] **Step 2: `AuthCallback.tsx`** — pass the picture when storing tokens:

```ts
        storeTokens(tokens.id_token, tokens.refresh_token, emailFromIdToken(tokens.id_token), pictureFromIdToken(tokens.id_token));
```
(import `pictureFromIdToken` alongside `emailFromIdToken`.)

- [ ] **Step 3: `lib/gravatar.ts`** — SHA-256 Gravatar URL:

```ts
export async function gravatarUrl(email: string): Promise<string> {
    const normalized = email.trim().toLowerCase();
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `https://www.gravatar.com/avatar/${hash}?d=404`;
}
```

- [ ] **Step 4: `PresenceDot.tsx`**:

```tsx
import { cn } from '@/lib/utils';

export function PresenceDot({ online, className }: { online: boolean; className?: string }) {
    return (
        <span
            className={cn(
                'block h-3 w-3 rounded-full ring-2 ring-background',
                online ? 'bg-green-500' : 'bg-muted-foreground/40',
                className,
            )}
            aria-label={online ? 'Online' : 'Offline'}
        />
    );
}
```

- [ ] **Step 5: `UserAvatar.tsx`** — resolves src (explicit → gravatar), overlays optional presence dot:

```tsx
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PresenceDot } from './PresenceDot';
import { gravatarUrl } from '@/lib/gravatar';
import { cn } from '@/lib/utils';

export function UserAvatar({
    email,
    src,
    online,
    className,
}: {
    email: string;
    src?: string | null;
    online?: boolean;
    className?: string;
}) {
    const [gravatar, setGravatar] = useState<string | undefined>();
    useEffect(() => {
        if (src) return; // explicit URL wins; skip gravatar work
        let cancelled = false;
        gravatarUrl(email).then((u) => { if (!cancelled) setGravatar(u); });
        return () => { cancelled = true; };
    }, [email, src]);

    const imageSrc = src || gravatar;
    const initials = email.slice(0, 2).toUpperCase();

    return (
        <span className={cn('relative inline-block', className)}>
            <Avatar className="h-9 w-9">
                {imageSrc ? <AvatarImage src={imageSrc} alt={email} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {online !== undefined && (
                <PresenceDot online={online} className="absolute -bottom-0.5 -right-0.5" />
            )}
        </span>
    );
}
```

- [ ] **Step 6: Gate** — `npm run build && npm run lint` → green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/pages/AuthCallback.tsx src/lib/gravatar.ts src/components/PresenceDot.tsx src/components/UserAvatar.tsx
git commit -m "feat: UserAvatar (stored/oauth picture -> gravatar -> initials) + PresenceDot"
```

---

### Task 8: Wire avatars + presence into the UI

**Files:**
- Modify: `app/src/components/chat/ConversationList.tsx`
- Modify: `app/src/components/chat/ChatHeader.tsx`
- Modify: `app/src/components/chat/Sidebar.tsx`
- Modify: `app/src/pages/Chat.tsx` (pass peer avatarUrl + online to header; widen `Chat` type)
- Modify: `app/src/components/chat/UserSearch.tsx` (widen `Chat` type only — additive)

- [ ] **Step 1: `ConversationList.tsx`** — widen the `Chat` type to `{ chatId; chatName; avatarUrl?: string }`, use `UserAvatar` + presence:

```tsx
import { usePresence } from '@/components/socket/SocketProvider';
import { UserAvatar } from '@/components/UserAvatar';
```
Replace the row's `<Avatar>…</Avatar>` with:
```tsx
                    <UserAvatar email={chat.chatName} src={chat.avatarUrl} online={isOnline(chat.chatName)} />
```
and add `const { isOnline } = usePresence();` in the component; update the `Chat` type to include `avatarUrl?: string`.

- [ ] **Step 2: `ChatHeader.tsx`** — accept `email`, `avatarUrl`, `online`; show avatar + Online/Offline:

```tsx
import { UserAvatar } from '@/components/UserAvatar';

export function ChatHeader({ name, avatarUrl, online }: { name: string; avatarUrl?: string; online: boolean }) {
    return (
        <div className="flex items-center gap-3 border-b p-3">
            {/* keep the existing mobile back button before this */}
            <UserAvatar email={name} src={avatarUrl} className="h-8 w-8" />
            <div className="flex flex-col">
                <span className="font-medium leading-tight">{name}</span>
                <span className="text-xs text-muted-foreground">{online ? 'Online' : 'Offline'}</span>
            </div>
        </div>
    );
}
```
(Preserve the `md:hidden` back button added earlier.)

- [ ] **Step 3: `Chat.tsx`** — widen the `Chat` type, derive peer `avatarUrl` + presence, pass to header:

```tsx
import { usePresence } from '@/components/socket/SocketProvider';
```
```tsx
    type Chat = { chatId: string; chatName: string; avatarUrl?: string };
    const peer = (chats ?? []).find((c) => c.chatId === chatId);
    const name = peer?.chatName ?? 'Conversation';
    const { isOnline } = usePresence();
```
```tsx
            <ChatHeader name={name} avatarUrl={peer?.avatarUrl} online={isOnline(name)} />
```

- [ ] **Step 4: `Sidebar.tsx`** — show your own avatar on the account dropdown trigger via `UserAvatar`:

```tsx
import { UserAvatar } from '@/components/UserAvatar';
import { getEmail, getPicture, logout } from '@/lib/auth';
```
Replace the trigger's `<Avatar>…</Avatar>` with:
```tsx
                            <UserAvatar email={email} src={getPicture()} className="h-7 w-7" />
```
(keep the `<span className="sr-only">Account menu</span>`).

- [ ] **Step 5: `UserSearch.tsx`** — widen its local `Chat` type to include `avatarUrl?: string` (additive; no behavior change) so it compiles against the enriched `chat/list`.

- [ ] **Step 6: Gate** — `npm run build && npm run lint && npm test` → green. Visually: conversation rows + chat header show photos (or initials) with a green/grey presence dot; open a second browser as the other user → dots flip online/offline live.

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/ConversationList.tsx src/components/chat/ChatHeader.tsx src/components/chat/Sidebar.tsx src/pages/Chat.tsx src/components/chat/UserSearch.tsx
git commit -m "feat: show avatars + live presence in conversation list and chat header"
```

---

## Self-Review

- Persist avatarUrl (spec §Persist) → Task 1; thread picture → Task 2. ✓
- chat/list peer avatarUrl (spec §Expose) → Task 3. ✓
- Presence registry in-memory (spec §Presence registry) → Task 4; socket broadcast (`presence:state`/`presence:update`) → Task 5. ✓
- App-level SocketProvider + useSocket refactor + usePresence (spec §App-level socket / Presence store) → Task 6. ✓
- UserAvatar precedence stored→gravatar→initials + own picture + PresenceDot (spec §Avatars) → Task 7. ✓
- Wire into ConversationList + ChatHeader + Sidebar account (spec §Integration) → Task 8. ✓
- Behavior preserved: SWR keys, join/leave/message untouched; chat/list shape extended additively (`avatarUrl?`). ✓
- Placeholder scan: full code in every step; shadcn `Avatar` internals reused (not transcribed). ✓
- Type consistency: `getOrCreateUserByEmail({email, avatarUrl?})`, `VerifiedIdentity.picture?`, `isOnline(email)`, `Chat {chatId,chatName,avatarUrl?}`, `presence:state: string[]`, `presence:update {email, online}` — consistent across tasks. ✓

## Not in this plan
Redis adapter / multi-instance presence (documented in the spec's Scaling section, for when `maxCapacity` > 1); typing indicators; "last seen"; message-bubble avatars.
