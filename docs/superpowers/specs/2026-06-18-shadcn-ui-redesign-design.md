# shadcn UI Redesign

**Date:** 2026-06-18
**Status:** Approved (design)
**Repo:** chat-app (`app/`) — frontend only

## Context

The SPA's UI is dated (plain Tailwind cards, an unstyled conversation list, a bare
`email: message` thread). This redesign rebuilds the presentation with shadcn/ui on
the existing Tailwind v4 setup into a modern two-pane messaging layout, with a
light/dark toggle. **No data, auth, or socket behavior changes** — only presentation,
a routing restructure for a persistent sidebar, and sender-based bubble alignment.

## Locked decisions
- **Full chat redesign** (not a re-skin): persistent sidebar + threaded message panel.
- **Light + dark toggle** via next-themes (already a dep), respecting system preference.
- **Base palette:** zinc (changeable).
- **Routing restructure:** a layout route renders the sidebar + `<Outlet/>`.
- **Sender-based bubble alignment:** "you" = `message.createdBy.email === getEmail()`.

## Foundation
- Initialize shadcn for Tailwind v4 (`components.json`, base color zinc).
- Add the `@/` path alias to `vite.config.ts` (resolve.alias) and `tsconfig.app.json`
  (`paths`).
- Replace the stock Vite `index.css` with shadcn's CSS-variable theme (`:root` light +
  `.dark` tokens; `@theme inline` mapping for Tailwind v4).
- Migrate `src/utils/cnHelper.ts` → `src/lib/utils.ts` (`cn`); update imports.
- New deps: radix primitives (pulled per component), `class-variance-authority`,
  `lucide-react`, `tw-animate-css`. Reuse `clsx`, `tailwind-merge`, `sonner`,
  `next-themes`.
- `ThemeProvider` (next-themes, `attribute="class"`, `defaultTheme="system"`) wraps the
  app in `main.tsx`; a `ModeToggle` (lucide sun/moon) lives in the sidebar header.

## shadcn components used
`button, input, textarea, card, avatar, scroll-area, dropdown-menu, separator,
skeleton, sonner, tooltip`.

## Layout

### App shell (authenticated area)
`ChatLayout` renders **Sidebar** + `<Outlet/>`, wrapped by the existing
`ApiHealthGate` → `ProtectedRoute`. Routing becomes:
- layout route `/` → `ChatLayout`
  - `index` → empty state ("Select a conversation")
  - `chat/:chatId` → thread

`/login` and `/auth/callback` stay public, outside the layout.

### Sidebar (~320px desktop)
App title + `ModeToggle`; an **avatar dropdown** (`DropdownMenu`) showing your email +
**Sign out** (`logout()`); a **user search** (`Input` + results, each with a "Message"
action calling the existing create-chat flow); the **conversation list** (`Avatar` +
peer email, active-row highlight via the current `chatId`, click → `chat/:chatId`).

### Thread (main pane)
- **Header:** peer `Avatar` + email.
- **Messages:** `ScrollArea` of `MessageBubble`s — right-aligned/`primary` for you,
  left-aligned/`muted` for the peer; auto-scroll to newest.
- **Composer:** `Textarea` + send `Button`; Enter sends, Shift+Enter newline; clears on
  send (existing behavior).

### Responsive
Desktop: both panes. Mobile (`< md`): sidebar list fills the screen; selecting a chat
shows the thread with a back button to the list.

## Login + utility pages
- **Login:** centered `Card` (app name + "Continue with Google" button with a lucide
  icon) on a subtle background.
- **NotFound / NoInternet / SiteDown:** `Card` + icon + message.
- **Loading:** `Skeleton` rows in the list/thread (replacing the full-page spinner where
  it fits).

## Preserved exactly (no behavior change)
SWR keys (`chat/list`, `user/search`, `message/list/:id`), the socket
`join`/`leave`/`message` lifecycle, `fetcher` (+ refresh-on-401), PKCE auth, the wake
gate. The data shapes are unchanged: chats `{chatId, chatName}` (chatName = peer email),
messages `{_id, content, createdBy:{email}}`, search `{_id, email}`.

## Component decomposition
`src/components/ui/*` (shadcn, generated); `src/components/theme/{ThemeProvider,ModeToggle}`;
`src/components/chat/{Sidebar, ConversationList, UserSearch, ChatHeader, MessageList,
MessageBubble, Composer, EmptyState}`; `src/layouts/ChatLayout.tsx`. Pages
(`Login`, `Chat`) and `App.tsx` routing rewired to use them; `Home.tsx` becomes the
index empty-state (or is replaced by `EmptyState`).

## Testing / verification
Presentational — each step gates on `npm run build` (tsc + vite) + `npm run lint`, with
visual verification in the running dev server (hot-reload). The PKCE vitest stays. No new
unit tests for pure-presentational components; if an `isMine(message, email)` helper is
extracted, it gets a small unit test.

## Out of scope
Backend changes; new chat features (group chats, attachments, read receipts, typing
indicators); Storybook.
