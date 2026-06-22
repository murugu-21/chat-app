# Architecture Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public, system-design landing page at `/` (moving the chat app under `/chat`), styled with chat-app's existing shadcn components and OKLch theme.

**Architecture:** A new presentational `Landing` page becomes the public root; the auth-gated chat subtree moves to `/chat`. The landing's only logic is a neutral primary CTA whose behavior depends on auth state, isolated as a pure helper. A shadcn `Badge` primitive is added; the PKCE sign-in is extracted into a shared helper reused by `Login` and the landing.

**Tech Stack:** React 19, Vite, Tailwind v4, shadcn/ui (cva + `radix-ui` Slot + `cn`), react-router, vitest (node env).

## Global Constraints

- **System design only:** NO auth/SSO content and NO Cloudflare/cost-saving content anywhere on the page — including tech badges (no Cognito, Cloudflare, API Gateway, or Lambda).
- **Routing:** landing is the public front door at `/`; the chat app moves under `/chat` (`/chat` index = `EmptyState`, `/chat/:chatId` = `Chat`).
- **Neutral CTA:** single primary button labeled **"Open the app →"**; if a token exists → go to `/chat`, else → start the PKCE sign-in. A secondary **"View on GitHub"** outline button links to `https://github.com/murugu-21/chat-app`.
- **Theme/components:** reuse the existing OKLch zinc tokens and root `ThemeProvider` (in `main.tsx`); add a top-right `ModeToggle`. Reuse `ui/button`, `ui/card`, `ui/separator`, `theme/mode-toggle`. No new fonts or theme files.
- **Tests run in `node` env (no DOM / no React Testing Library)** — unit-test pure logic only; verify presentational output via `npm run build` + `npm run lint` + a manual visual check against the approved mockup.
- Gates from `app/`: `npm run build`, `npm run lint`, `npm test`.
- ESM/TypeScript; imports follow existing style (the app uses the `@/` alias for `src`).

---

## File Structure

- `app/src/lib/cta.ts` (new) — pure `ctaAction(token)` decision helper (no other imports, so it's testable in node env).
- `app/src/lib/cta.test.ts` (new) — unit tests for `ctaAction`.
- `app/src/lib/auth.ts` (modify) — add `startSignIn()` (the extracted PKCE redirect).
- `app/src/pages/Login.tsx` (modify) — use `startSignIn()`.
- `app/src/components/ui/badge.tsx` (new) — shadcn Badge primitive.
- `app/src/pages/Landing.tsx` (new) — the page (stub in Task 2, full content in Task 3).
- `app/src/App.tsx` (modify) — routing move.
- `app/src/pages/AuthCallback.tsx` (modify) — post-login redirect `/` → `/chat`.
- `app/src/components/chat/ChatHeader.tsx` (modify) — mobile back button `/` → `/chat`.

---

### Task 1: Shared `startSignIn` + pure `ctaAction` helpers; refactor `Login`

Extract the PKCE sign-in out of `Login` into `lib/auth.ts`, and add a pure CTA-decision helper in its own module so it's unit-testable without a DOM.

**Files:**
- Create: `app/src/lib/cta.ts`
- Create: `app/src/lib/cta.test.ts`
- Modify: `app/src/lib/auth.ts`
- Modify: `app/src/pages/Login.tsx`

**Interfaces:**
- Produces:
  - `type CtaAction = { kind: 'open' } | { kind: 'signin' }` and `ctaAction(token: string | null): CtaAction` in `lib/cta.ts`
  - `startSignIn(): Promise<void>` in `lib/auth.ts`
- Consumes: existing `generateVerifier`, `challengeFor`, `authorizeUrl` from `lib/pkce`; `cognitoConfig` from `lib/auth`.

- [ ] **Step 1: Write the failing test for `ctaAction`**

Create `app/src/lib/cta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { ctaAction } from './cta';

describe('ctaAction', () => {
    it('returns open when a token is present', () => {
        expect(ctaAction('id-token')).toEqual({ kind: 'open' });
    });

    it('returns signin when there is no token', () => {
        expect(ctaAction(null)).toEqual({ kind: 'signin' });
    });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd app && npx vitest run src/lib/cta.test.ts`
Expected: FAIL — cannot resolve `./cta`.

- [ ] **Step 3: Implement the pure helper**

Create `app/src/lib/cta.ts`:

```ts
// Decision for the landing's primary CTA, given the stored auth token.
// Pure (no imports) so it is unit-testable in the node test env.
export type CtaAction = { kind: 'open' } | { kind: 'signin' };

export const ctaAction = (token: string | null): CtaAction =>
    token ? { kind: 'open' } : { kind: 'signin' };
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd app && npx vitest run src/lib/cta.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Extract `startSignIn` into `lib/auth.ts`**

In `app/src/lib/auth.ts`, change the first import line to also pull the PKCE functions:

```ts
import { generateVerifier, challengeFor, authorizeUrl, type CognitoConfig } from './pkce';
```

Then add this exported function (e.g. just after `cognitoConfig`):

```ts
// Begin the Cognito PKCE redirect: stash verifier + state, then navigate to the
// hosted-UI authorize URL. Shared by the Login page and the landing CTA.
export const startSignIn = async (): Promise<void> => {
    const verifier = generateVerifier();
    const challenge = await challengeFor(verifier);
    const state = generateVerifier(); // reuse as random state
    sessionStorage.setItem('chat.pkceVerifier', verifier);
    sessionStorage.setItem('chat.oauthState', state);
    window.location.href = authorizeUrl(cognitoConfig(), challenge, state);
};
```

Note: `auth.ts` already declares `cognitoConfig` and imported only `type { CognitoConfig }` from `./pkce` — the changed import line adds the runtime functions alongside the type.

- [ ] **Step 6: Refactor `Login.tsx` to use it**

In `app/src/pages/Login.tsx`, replace the inline `signIn` and its now-unused pkce imports. The new file:

```tsx
import type { JSX } from 'react';
import { startSignIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage(): JSX.Element {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Chat app</CardTitle>
                    <CardDescription>Sign in to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={() => void startSignIn()}>Continue with Google</Button>
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 7: Build, lint, and full test run**

Run: `cd app && npm run build && npm run lint && npm test`
Expected: build + lint clean; all tests pass (including the 2 new `ctaAction` tests). The Login refactor is behavior-preserving.

- [ ] **Step 8: Commit**

```bash
cd app && git add src/lib/cta.ts src/lib/cta.test.ts src/lib/auth.ts src/pages/Login.tsx
git commit -m "refactor(auth): shared startSignIn + pure ctaAction helper"
```

---

### Task 2: shadcn `Badge` + routing move (landing stub)

Add the Badge primitive, make `/` a (stub) public `Landing` with the wired CTA, move the chat app under `/chat`, and fix the two `/`→app redirects.

**Files:**
- Create: `app/src/components/ui/badge.tsx`
- Create: `app/src/pages/Landing.tsx` (stub)
- Modify: `app/src/App.tsx`
- Modify: `app/src/pages/AuthCallback.tsx`
- Modify: `app/src/components/chat/ChatHeader.tsx`

**Interfaces:**
- Consumes: `ctaAction` (`lib/cta`), `startSignIn` + `getToken` (`lib/auth`), `ModeToggle` (`components/theme/mode-toggle`), `Button` (`components/ui/button`).
- Produces: `Badge` (+ `badgeVariants`) in `ui/badge.tsx`; default-exported `Landing` page; routes `/` (Landing) and `/chat` (app).

- [ ] **Step 1: Add the shadcn Badge**

Create `app/src/components/ui/badge.tsx` (mirrors the repo's `button.tsx` cva + `radix-ui` Slot + `cn` style):

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-white",
        outline:
          "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
```

- [ ] **Step 2: Create the Landing stub with the wired CTA**

Create `app/src/pages/Landing.tsx`. This stub proves routing + CTA end-to-end; Task 3 fills in the full content around the same `<header>` and `onOpenApp` handler.

```tsx
import type { JSX } from 'react';
import { useNavigate } from 'react-router';

import { getToken, startSignIn } from '@/lib/auth';
import { ctaAction } from '@/lib/cta';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/theme/mode-toggle';

const GITHUB_URL = 'https://github.com/murugu-21/chat-app';

export default function Landing(): JSX.Element {
    const navigate = useNavigate();

    const onOpenApp = () => {
        const action = ctaAction(getToken());
        if (action.kind === 'open') navigate('/chat');
        else void startSignIn();
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                <span className="font-semibold tracking-tight">💬 Chat app</span>
                <ModeToggle />
            </header>
            <main className="mx-auto max-w-5xl px-6 py-24">
                <h1 className="text-4xl font-semibold tracking-tight">Inside a real-time chat system.</h1>
                <div className="mt-6 flex gap-3">
                    <Button onClick={onOpenApp}>Open the app →</Button>
                    <Button variant="outline" asChild><a href={GITHUB_URL}>View on GitHub</a></Button>
                </div>
            </main>
        </div>
    );
}
```

- [ ] **Step 3: Move routing — `/` → Landing, app → `/chat`**

In `app/src/App.tsx`, add the `Landing` import and restructure the routes inside the `online ?` branch. Replace the existing `<Routes>…</Routes>` online block with:

```tsx
import Landing from './pages/Landing';
```

```tsx
                    {online ? (
                        <>
                            <Route path="/" element={<Landing />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />
                            <Route path="/chat" element={<ApiHealthGate><ProtectedRoute /></ApiHealthGate>}>
                                <Route element={<ChatLayout />}>
                                    <Route index element={<EmptyState />} />
                                    <Route path=":chatId" element={<Chat />} />
                                </Route>
                            </Route>

                            <Route path="*" element={<NotFound />} />
                        </>
                    ) : (
                        <Route path="*" element={<NoInternet />}></Route>
                    )}
```

(Note: `:chatId` is now nested under `/chat`, so the full path stays `/chat/:chatId` — matching `ConversationList`'s existing absolute `navigate('/chat/${chat.chatId}')`.)

- [ ] **Step 4: Fix the post-login redirect**

In `app/src/pages/AuthCallback.tsx`, change the success redirect (currently `navigate('/', { replace: true })`) to:

```tsx
                navigate('/chat', { replace: true });
```

- [ ] **Step 5: Fix the mobile back button**

In `app/src/components/chat/ChatHeader.tsx`, change the back button's `onClick={() => navigate('/')}` to:

```tsx
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/chat')}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Back</span></Button>
```

- [ ] **Step 6: Verify no other `/`→app references remain**

Run: `cd app && grep -rnE "navigate\('/'\)|to=\"/\"|href=\"/\"" src`
Expected: no matches (AuthCallback and ChatHeader were the only two; both now point at `/chat`). If any remain that mean "the app home", change them to `/chat`.

- [ ] **Step 7: Build, lint, manual nav check**

Run: `cd app && npm run build && npm run lint && npm test`
Expected: build + lint clean; tests pass.
Manual (dev server): `/` shows the landing stub; **Open the app →** goes to `/chat` when signed in or starts Google sign-in when not; after sign-in the callback lands on `/chat`; the mobile back button in a chat returns to `/chat`.

- [ ] **Step 8: Commit**

```bash
cd app && git add src/components/ui/badge.tsx src/pages/Landing.tsx src/App.tsx src/pages/AuthCallback.tsx src/components/chat/ChatHeader.tsx
git commit -m "feat(landing): public / landing stub; move chat app under /chat"
```

---

### Task 3: Full landing page content

Replace the stub body with all sections, faithful to the approved mockup, using shadcn `Card`/`Badge`/`Separator`/`Button` and the existing theme tokens. The `<header>` and `onOpenApp` from Task 2 are kept.

**Files:**
- Modify: `app/src/pages/Landing.tsx`

**Interfaces:**
- Consumes: `Badge` (`ui/badge`), `Separator` (`ui/separator`), `Card` (`ui/card`), `Button`, `ModeToggle`, `getToken`/`startSignIn`, `ctaAction`.

- [ ] **Step 1: Replace `Landing.tsx` with the full page**

Overwrite `app/src/pages/Landing.tsx` with:

```tsx
import type { JSX } from 'react';
import { useNavigate } from 'react-router';

import { getToken, startSignIn } from '@/lib/auth';
import { ctaAction } from '@/lib/cta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ModeToggle } from '@/components/theme/mode-toggle';

const GITHUB_URL = 'https://github.com/murugu-21/chat-app';

const STEPS = [
    { n: 1, title: 'Join the room', body: 'On opening a conversation, the client joins a Socket.IO room keyed by chat id over its socket.' },
    { n: 2, title: 'Write, then broadcast', body: 'A sent message is persisted to MongoDB, then emitted to the room — the sender included — as one event.' },
    { n: 3, title: 'Clients reconcile', body: "Every participant's client merges the event into its SWR cache, so the thread stays consistent without a refetch." },
];

const FLOW = [
    { label: 'React SPA', sub: 'socket.io-client · SWR' },
    { label: 'Express + Socket.IO', sub: 'REST · WebSocket events' },
];

const PROPS = [
    { title: 'Event-driven real time', body: 'Messages and presence are Socket.IO events, not polling. The server is the source of truth; clients merge events into an SWR cache for instant, consistent threads.' },
    { title: 'Presence by connection-count', body: 'A user is online while at least one socket is open — multi-tab safe. The server broadcasts a delta only on the 0→1 and 1→0 transitions, so peers see clean online/offline edges.' },
    { title: 'Built to scale out', body: 'The Socket.IO Redis adapter fans broadcasts across nodes and presence lives in a shared Redis hash — so the same code runs as one box today or many behind sticky sessions.' },
];

const COLLECTIONS = [
    { name: 'users', body: 'Identity + profile: email, display name, avatar URL.' },
    { name: 'chats', body: 'A conversation and its participants; the room key for real-time events.' },
    { name: 'messages', body: 'Chat reference, sender, body, timestamps — the persisted log behind every broadcast.' },
];

const TECH = ['React 19', 'Vite', 'Tailwind v4', 'shadcn/ui', 'TypeScript', 'Express', 'Socket.IO', 'MongoDB', 'Redis', 'SWR', 'AWS CDK', 'EC2', 'Docker · GHCR', 'Sentry', 'Vitest'];

function Eyebrow({ children }: { children: React.ReactNode }) {
    return <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>;
}

export default function Landing(): JSX.Element {
    const navigate = useNavigate();

    const onOpenApp = () => {
        const action = ctaAction(getToken());
        if (action.kind === 'open') navigate('/chat');
        else void startSignIn();
    };

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                <span className="font-semibold tracking-tight">💬 Chat app</span>
                <ModeToggle />
            </header>
            <Separator />

            {/* HERO */}
            <section className="mx-auto max-w-5xl px-6 py-20">
                <Badge variant="secondary">System design</Badge>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                    Inside a real-time<br /><span className="text-primary">chat system.</span>
                </h1>
                <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                    How messages and presence move in real time over Socket.IO — and how the event layer is designed to scale horizontally with Redis.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                    <Button onClick={onOpenApp}>Open the app →</Button>
                    <Button variant="outline" asChild><a href={GITHUB_URL}>View on GitHub</a></Button>
                </div>
            </section>
            <Separator />

            {/* HOW A MESSAGE TRAVELS */}
            <section className="mx-auto max-w-5xl px-6 py-20">
                <div className="mx-auto mb-12 max-w-2xl text-center">
                    <Eyebrow>Real-time flow</Eyebrow>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">How a message travels</h2>
                    <p className="mt-2 text-muted-foreground">Every conversation is a Socket.IO room; sending is write-then-broadcast.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    {STEPS.map((s) => (
                        <div key={s.n}>
                            <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{s.n}</div>
                            <h3 className="mt-3 font-semibold">{s.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                        </div>
                    ))}
                </div>
            </section>
            <Separator />

            {/* ARCHITECTURE */}
            <section className="mx-auto max-w-5xl px-6 py-20">
                <div className="mx-auto mb-12 max-w-2xl text-center">
                    <Eyebrow>Architecture</Eyebrow>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">The moving parts</h2>
                    <p className="mt-2 text-muted-foreground">A React client, a stateful Socket.IO server, and two backing stores.</p>
                </div>
                <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                    {FLOW.map((node, i) => (
                        <div key={node.label} className="flex items-stretch gap-2">
                            <Card className="min-w-40 shrink-0 px-4 py-3">
                                <div className="text-sm font-semibold">{node.label}</div>
                                <div className="mt-1 font-mono text-xs text-muted-foreground">{node.sub}</div>
                            </Card>
                            <span className="self-center px-1 text-muted-foreground">{i === 0 ? '⇄' : '→'}</span>
                        </div>
                    ))}
                    <div className="flex shrink-0 flex-col gap-2">
                        <Card className="min-w-40 px-4 py-3"><div className="text-sm font-semibold">MongoDB</div><div className="mt-1 font-mono text-xs text-muted-foreground">users · chats · messages</div></Card>
                        <Card className="min-w-40 px-4 py-3"><div className="text-sm font-semibold">Redis</div><div className="mt-1 font-mono text-xs text-muted-foreground">presence · pub/sub fan-out</div></Card>
                    </div>
                </div>
            </section>
            <Separator />

            {/* DESIGN DECISIONS */}
            <section className="mx-auto max-w-5xl px-6 py-20">
                <div className="mx-auto mb-12 max-w-2xl text-center">
                    <Eyebrow>Design decisions</Eyebrow>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">What makes it tick</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    {PROPS.map((p) => (
                        <Card key={p.title} className="p-6">
                            <h3 className="font-semibold">{p.title}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                        </Card>
                    ))}
                </div>
            </section>
            <Separator />

            {/* DATA MODEL */}
            <section className="mx-auto max-w-5xl px-6 py-20">
                <div className="mx-auto mb-12 max-w-2xl text-center">
                    <Eyebrow>Persistence</Eyebrow>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">Data model</h2>
                    <p className="mt-2 text-muted-foreground">Three MongoDB collections; messages reference their chat.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    {COLLECTIONS.map((c) => (
                        <Card key={c.name} className="p-6">
                            <h3 className="font-mono font-semibold">{c.name}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
                        </Card>
                    ))}
                </div>
            </section>
            <Separator />

            {/* TECH */}
            <section className="mx-auto max-w-5xl px-6 py-20">
                <div className="mb-10 text-center"><Eyebrow>Stack</Eyebrow><h2 className="mt-1 text-3xl font-semibold tracking-tight">Built with</h2></div>
                <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
                    {TECH.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
            </section>
            <Separator />

            {/* CTA */}
            <section className="mx-auto max-w-5xl px-6 py-20 text-center">
                <h2 className="text-3xl font-semibold tracking-tight">See it in motion</h2>
                <p className="mx-auto mt-3 mb-6 max-w-md text-muted-foreground">Open the app and watch messages and presence update live.</p>
                <Button onClick={onOpenApp}>Open the app →</Button>
            </section>

            <footer className="py-10 text-center text-sm text-muted-foreground">Chat app · built by murugappan</footer>
        </div>
    );
}
```

- [ ] **Step 2: Build + lint**

Run: `cd app && npm run build && npm run lint`
Expected: clean. (If lint flags the `React.ReactNode` reference in `Eyebrow` without a React import, add `import * as React from 'react'` or type the prop as `{ children: import('react').ReactNode }`.)

- [ ] **Step 3: Full test run**

Run: `cd app && npm test`
Expected: all tests pass (no new tests; `ctaAction` from Task 1 still green).

- [ ] **Step 4: Manual visual check**

Run the dev server and open `/`. Compare against the approved mockup: hero → how-a-message-travels → architecture flow (scrolls horizontally on narrow widths) → design decisions → data model → tech badges → CTA → footer. Toggle light/dark via the top-right `ModeToggle`. Confirm grids collapse to one column on mobile.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/pages/Landing.tsx
git commit -m "feat(landing): full system-design landing page content"
```

---

## Self-Review

**Spec coverage:** public `/` landing + app under `/chat` (Task 2) ✓; AuthCallback `/`→`/chat` + ChatHeader back fix + grep for others (Task 2) ✓; shared PKCE `startSignIn` extracted + reused (Task 1) ✓; neutral conditional CTA via pure `ctaAction` (Tasks 1–2) ✓; shadcn `Badge` added (Task 2) ✓; all sections — hero, how-a-message-travels, architecture flow, design decisions, data model, tech badges, CTA, footer (Task 3) ✓; reuse OKLch theme + root ThemeProvider + ModeToggle (Tasks 2–3) ✓; system-design-only, no auth/Cloudflare content incl. badges (Task 3 TECH list) ✓; node-env testing of pure logic only + build/lint/visual (all tasks) ✓.

**Deviation from spec (noted):** the spec proposed a React-Testing-Library smoke test, but the repo's vitest runs in `node` with no RTL/jsdom. To honor the intent (test the conditional CTA logic) without adding a DOM stack for one presentational page, the CTA decision is isolated as the pure `ctaAction` and unit-tested; rendering is covered by build/lint + the manual visual check. This matches the repo's existing pure-unit-test convention.

**Placeholder scan:** none — every code step contains complete code; the only conditional note (Task 3 Step 2, React import for `ReactNode`) gives the exact fix.

**Type consistency:** `ctaAction(token: string | null): CtaAction` with `{ kind: 'open' } | { kind: 'signin' }` is used identically in `cta.ts`, its test, and both `Landing` variants. `startSignIn(): Promise<void>` is consumed by `Login` and `Landing`. `Badge`/`badgeVariants` export names match their import in `Landing`. Routes: `/chat` base with nested `index` + `:chatId` matches `ConversationList`'s absolute `/chat/${id}`.
