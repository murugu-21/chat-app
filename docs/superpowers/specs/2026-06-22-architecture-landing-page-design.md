# Architecture Landing Page

**Date:** 2026-06-22
**Status:** Approved (design)
**Repo:** chat-app — `app/` (frontend SPA)

## Context

The chat-app SPA has no public page — `/` is auth-gated and routes straight into the
chat. This adds a **public, system-design landing page** at `/` that explains how the
real-time chat system is built, styled like the eventform landing (clean, gradient-free,
section rhythm) but reusing chat-app's own shadcn components and OKLch zinc theme. An
approved static mockup of the look-and-feel exists (built during brainstorming).

The page **sells the system design** — real-time messaging, presence, and horizontal
scalability. It deliberately does **not** discuss authentication/SSO or any
cost/Cloudflare angle.

## Locked decisions

- **Routing:** the landing is the **public front door at `/`**, always viewable. The chat
  app moves under **`/chat`** (`/chat` index = `EmptyState`, `/chat/:chatId` = `Chat`).
- **Primary CTA:** a single **"Open the app →"** button. Behavior is conditional on auth
  state but the *copy stays neutral* (no prominent "Sign in" language, per the
  system-design-only focus): if `getToken()` is present → navigate to `/chat`; otherwise →
  start the existing Cognito PKCE redirect. A secondary **"View on GitHub"** outline button
  links to `https://github.com/murugu-21/chat-app`.
- **Content scope:** system design only. **No** auth/SSO/Cognito content and **no**
  Cloudflare/cost-saving content anywhere on the page (including tech badges).
- **Theme/styling:** reuse chat-app's existing OKLch zinc tokens and the root
  `ThemeProvider` (already wraps the app in `main.tsx`). Add a top-right `mode-toggle`.
  No new fonts or theme files.
- **Components:** use chat-app's real shadcn components — `ui/button`, `ui/card`,
  `ui/separator`, `theme/mode-toggle`. A shadcn **`ui/badge`** component does **not** exist
  yet and must be added.

---

## Routing changes (`app/src/App.tsx`)

Current (inside the `online` block): `/login`, `/auth/callback`, and an auth-gated subtree
(`ApiHealthGate > ProtectedRoute > ChatLayout` with index `EmptyState` and `chat/:chatId`).

Change to:
- Add public route `path="/"` → `Landing` (sibling of `/login`, outside the gated subtree).
- Move the gated subtree to `path="/chat"`: `/chat` index → `EmptyState`, `/chat/:chatId` →
  `Chat`. (The gate/layout wrappers are unchanged; only the base path moves.)
- `/login`, `/auth/callback`, the `*` NotFound, and the offline branch are unchanged.

Consequences to update:
- **`app/src/pages/AuthCallback.tsx`** — the post-exchange redirect `navigate('/')` becomes
  `navigate('/chat')` (so a freshly-signed-in user lands in the app, not the marketing page).
- **In-app navigation that targets the chat index** — any link/redirect that assumed `/`
  meant the app (e.g. brand/logo link, post-logout, conversation-list "home") must point to
  `/chat`. The plan must grep for these (`to="/"`, `navigate('/')`, `href="/"`) across
  `app/src` and fix each.
- **`ProtectedRoute`** unauthenticated redirect (currently to `/login`) is unchanged.

## Shared PKCE sign-in helper

`app/src/pages/Login.tsx` holds the PKCE `signIn()` inline (generate verifier/challenge/
state, stash in `sessionStorage`, redirect to `authorizeUrl(...)`). Extract it to a shared
function — `startSignIn()` in `app/src/lib/auth.ts` — and call it from both `Login` and the
landing CTA. This is a DRY refactor with no behavior change; `Login.tsx`'s button keeps
working through the extracted function.

---

## Page structure (`app/src/pages/Landing.tsx`)

A single scroll page, max-width container, `<Separator/>` between sections, top bar with the
brand and a `mode-toggle`. Sections, in order:

1. **Hero** — `Badge` "System design"; headline *"Inside a real-time chat system."* (the
   second line accented via `text-primary`); a one-line lead about messages + presence over
   Socket.IO and scaling with Redis; the **Open the app →** primary CTA + **View on GitHub**
   outline CTA.
2. **How a message travels** (eyebrow "Real-time flow") — three numbered steps:
   ① Join the room (Socket.IO room per chat id) → ② Write, then broadcast (persist to
   MongoDB, then emit to the room, sender included) → ③ Clients reconcile (each participant
   merges the event into its SWR cache, no refetch).
3. **Architecture** (eyebrow "Architecture") — a horizontal, horizontally-scrollable flow of
   `FlowNode`s: `React SPA (socket.io-client · SWR)` ⇄ `Express + Socket.IO (REST · WebSocket
   events)` → stacked pair `MongoDB (users · chats · messages)` + `Redis (presence · pub/sub
   fan-out)`. Connectors are `Arrow` glyphs (`⇄` then `→`).
4. **Design decisions** (eyebrow) — three `Card`s: **Event-driven real time** (events not
   polling; server is source of truth; clients merge into SWR) · **Presence by
   connection-count** (online while ≥1 socket open, multi-tab safe; delta broadcast only on
   0→1 / 1→0) · **Built to scale out** (Socket.IO Redis adapter fans broadcasts across nodes;
   presence in a shared Redis hash; same code on one box or many).
5. **Data model** (eyebrow "Persistence") — three `Card`s for the MongoDB collections:
   `users`, `chats`, `messages` (with one-line descriptions).
6. **Tech** (eyebrow "Stack") — outline `Badge`s: React 19, Vite, Tailwind v4, shadcn/ui,
   TypeScript, Express, Socket.IO, MongoDB, Redis, SWR, AWS CDK, EC2, Docker · GHCR, Sentry,
   Vitest. (No Cognito, Cloudflare, API Gateway, or Lambda.)
7. **Footer CTA** — heading + **Open the app →** button.
8. **Footer** — "Chat app · built by murugappan".

### Components & files
- **Create `app/src/pages/Landing.tsx`** — the page. Small presentational helpers
  (`Step`, `FlowNode`, `Arrow`, `TechBadge` or direct `Badge` usage) are co-located in this
  file, as the eventform landing does — unless one grows non-trivial, in which case split
  into `app/src/components/landing/`.
- **Create `app/src/components/ui/badge.tsx`** — the standard shadcn Badge (CVA variants:
  `default`, `secondary`, `outline`; uses existing theme tokens). Used for the hero tag and
  tech pills.
- **Reuse** `ui/button`, `ui/card`, `ui/separator`, `theme/mode-toggle`, `lib/utils` (`cn`).

---

## Theme & responsiveness

The root `ThemeProvider` (`main.tsx`) already wraps `<App/>`, so the landing inherits
light/dark context with no change; the page adds its own top-right `mode-toggle`. Layout is
responsive: the steps and card grids collapse to one column on small screens, and the
architecture flow row scrolls horizontally (`overflow-x-auto`) rather than wrapping.

## Testing

The only logic on the page is the auth-conditional primary CTA; everything else is
presentational. Cover with a small React Testing Library smoke test
(`app/src/pages/Landing.test.tsx`):
- Renders the hero headline and the section eyebrows/headings ("How a message travels",
  "Architecture", "Design decisions", "Data model").
- With no token in `localStorage`, clicking **Open the app →** triggers the sign-in path
  (assert `startSignIn` is invoked — mock it).
- With a token present, the CTA navigates to `/chat` (assert navigation / `href`).

Gates from `app/`: `npm run build`, `npm run lint`, `npm test`. Plus a manual visual check
in the dev server against the approved mockup.

## Out of scope (YAGNI)

CMS/editable content; animations beyond simple hover/transition; i18n; analytics; any
auth/SSO or Cloudflare/cost messaging; changing the chat app's internals (this is additive +
a routing move only).
