# User Presence + Persisted Avatars

**Date:** 2026-06-18
**Status:** Approved (design)
**Repo:** chat-app — `server/` + `app/`

## Context

Add real-time **online/offline presence** and **profile avatars** to the chat app.
Avatars are persisted in the DB (each user's OAuth `picture` is stored on login), so
both you and your peers show real photos, with Gravatar then initials as fallbacks.
Presence is tracked **in-memory** on the single backend instance (the ASG runs
`maxCapacity: 1`), which is the correct layer for this deployment; a Redis migration
path is documented for when the backend scales horizontally.

## Locked decisions
- **Presence:** binary online/offline (no "last seen").
- **Indicators:** conversation list (dot on avatar) **and** chat header (dot + label).
- **Avatars:** your image = Google `picture` from the id token; peers' image = the
  `avatarUrl` we store for them; fallback **stored URL → Gravatar(email) → initials**.
- **Persist avatar in DB:** store/refresh `avatarUrl` on every login (JIT upsert).
- **Presence layer:** in-memory (single instance, `maxCapacity: 1`). Redis only when
  scaling to 2+ instances (see "Scaling" below).
- **Socket refactor:** one app-level socket via a `SocketProvider`, shared by presence
  and the message thread (today the socket only connects inside an open chat).

---

## Server

### Persist the avatar at login
- **`user.model.ts`**: add `avatarUrl: { type: String, required: false }`.
- **`cognito.verifier.ts`**: extract the `picture` claim → `VerifiedIdentity` gains
  `picture?: string`. (The Cognito pool maps `GOOGLE_PICTURE` → `picture` and we request
  the `profile` scope, so the id token carries it; dev-mode tokens simply omit it.)
- **`requireAuth` (auth.middleware) + socket auth (`makeSocketAuth`)**: pass the verified
  `picture` into JIT provisioning.
- **`getOrCreateUserByEmail({ email, avatarUrl })`** (repository + service): 
  `findOneAndUpdate({ email }, { ...(avatarUrl ? { $set: { avatarUrl } } : {}), $setOnInsert: { email } }, { upsert: true, new: true, setDefaultsOnInsert: true })`.
  Stored on first login, refreshed on each subsequent login; never cleared when absent
  (dev tokens).

### Expose peers' avatars
- **`chat/list`** (`listChatsOfUser`): enrich each chat with the peer's `avatarUrl` by
  looking up the `User` whose email = `chatName`. Response shape:
  `{ chatId, chatName, avatarUrl?: string }`. (Batch the lookup: collect the peer emails
  and query `userModel.find({ email: { $in: emails } })` once, then map.)

### Presence registry (in-memory)
- **`features/presence/presence.ts`** — a pure module over `Map<string, number>`
  (email → active connection count):
  - `addConnection(email): boolean` — increments; returns `true` on the 0→1 transition.
  - `removeConnection(email): boolean` — decrements (floored at 0); returns `true` on the
    1→0 transition.
  - `onlineEmails(): string[]` — keys with count > 0.
  - `isOnline(email): boolean`.
  Connection counting handles multiple tabs/devices: offline only when the last socket drops.

### Socket wiring (`socket/index.ts`)
Replace the `console.log` connect/disconnect lines with:
- on `connection`: `const wentOnline = addConnection(email)`; emit `presence:state`
  (`onlineEmails()`) to **this** socket; if `wentOnline`, `socket.broadcast.emit('presence:update', { email, online: true })`.
- on `disconnect`: `const wentOffline = removeConnection(email)`; if `wentOffline`,
  `io.emit('presence:update', { email, online: false })`.
All over the existing socket connection — no new HTTP endpoint.

---

## Client

### App-level socket (`SocketProvider`)
- **`components/socket/SocketProvider.tsx`** — a React context mounted in `ChatLayout`.
  Creates one socket (stable via ref, `auth: (cb) => cb({ token: getToken() })`),
  connects on mount / disconnects on unmount. Exposes `{ socket }`.
- Refactor **`hooks/useSocket.tsx`** → `useSocket()` returns the context's socket (it no
  longer creates its own). `Chat`'s join/leave/message use this shared socket.

### Presence store
- **`usePresence`** (in `SocketProvider` or a sibling context): seeds an online `Set<string>`
  from `presence:state`, applies `presence:update` deltas, exposes `isOnline(email): boolean`.
  Cleans up its listeners on unmount.

### Avatars
- **`lib/auth.ts`**: `pictureFromIdToken(idToken)` (decode `picture`); store it at callback
  alongside email (`chat.picture`); `getPicture(): string | null`.
- **`lib/gravatar.ts`**: `gravatarUrl(email): Promise<string>` — `https://www.gravatar.com/avatar/${sha256(email.trim().toLowerCase())}?d=404` (SHA-256 via Web Crypto; `d=404` so a missing Gravatar errors and the fallback shows).
- **`components/UserAvatar.tsx`** — wraps shadcn `Avatar`. Props `{ email, src?, presence? }`.
  Image precedence: explicit `src` (stored `avatarUrl` for peers / `getPicture()` for you)
  → resolved Gravatar URL → none. `AvatarImage` auto-falls-back to `AvatarFallback`
  (initials from email) on load error. Optional `PresenceDot` overlay (bottom-right).
- **`components/PresenceDot.tsx`** — small green (online) / muted (offline) dot.

### Integration
- **`ConversationList`**: replace `Avatar`+initials with `UserAvatar` (`email=chatName`,
  `src=chat.avatarUrl`, `presence` overlay via `isOnline(chatName)`).
- **`ChatHeader`**: `UserAvatar` for the peer + an "Online"/"Offline" label + dot.
- **`Sidebar` account dropdown trigger**: `UserAvatar` for you (`email=getEmail()`,
  `src=getPicture()`). No presence dot on yourself.

---

## Data flow
Login → verifier extracts `picture` → JIT upsert stores `avatarUrl`. Client signs in →
`SocketProvider` connects → server marks online, sends `presence:state` to it and
broadcasts the delta to others → `usePresence` updates → dots/labels re-render. `chat/list`
carries each peer's `avatarUrl` → `UserAvatar` shows the real photo (→ Gravatar → initials).

## Testing
- **Server (unit):** presence registry transitions + multi-connection counting;
  verifier extracts `picture` (extend the local-JWKS test with a `picture` claim);
  `getOrCreateUserByEmail` upserts `avatarUrl` on insert and refreshes on update
  (mongodb-memory-server).
- **Client:** `usePresence` reducer logic may get a small unit test; `UserAvatar`/dots are
  presentational → `npm run build` + `npm run lint` + visual check in the running dev server.

## Scaling (when `maxCapacity` > 1) — not built now
The in-memory presence `Map` and direct `io.emit` are correct only for a single instance.
To scale horizontally: add `@socket.io/redis-adapter` + a Redis (ElastiCache) so events
fan out across instances; move the presence registry into Redis (shared counts); enable
sticky sessions at the load balancer; bump the ASG `maxCapacity`. Documented as a future
step in `docs/DEPLOYMENT.md`.

## Out of scope (YAGNI)
Typing indicators; "last seen" timestamps; avatars on message bubbles; Redis/multi-instance
now.
