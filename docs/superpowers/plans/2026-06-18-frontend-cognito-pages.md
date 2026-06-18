# Frontend: Cognito PKCE + Cloudflare Pages (Sub-project 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the chat-app SPA's email/password login with Cognito authorization-code + PKCE (against the shared `auth.murugappan.dev` hosted UI), send the Cognito **id token** to the API + socket, add an `ApiHealthGate` that wakes the scale-to-zero backend, and prep Cloudflare Pages.

**Architecture:** PKCE helpers (Web Crypto, no deps) drive a redirect to Cognito's hosted UI (pinned to Google). The callback exchanges the code for tokens and stores the **id_token** under `localStorage 'token'` (so the existing `fetcher`/`ProtectedRoute` keep working) plus a refresh token + email. `fetcher` retries once via refresh-token on 401. `ApiHealthGate` wraps the app and wakes the backend when `/health` is down.

**Tech Stack:** React 18 + react-router 7, Vite, TypeScript, socket.io-client, Web Crypto (PKCE), vitest (new, for pkce).

## Global Constraints

- **Reuse:** eventform's `apps/web/src/lib/pkce.ts` is copied VERBATIM; its `pages/auth-callback.tsx` and `components/api-health-gate.tsx` are the references to ADAPT (read them at `/Users/murugappan/personal/eventform/apps/web/src/...`). eventform uses an `@/` import alias; chat-app uses RELATIVE imports — convert.
- **Send the id token, not the access token.** chat-app's API (SP1) verifies the Cognito **id** token (`token_use==='id'`, carries email). Store `id_token` under `localStorage 'token'`.
- **Cognito (already deployed):** domain `https://auth.murugappan.dev`, client id `5c32fqvmu4fmta044ut5udm6j1`, scopes `openid email profile`, IdP pinned to `Google`, redirect `${origin}/auth/callback`. Issuer `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_el6h3ZKKw`.
- **Single origin:** after SP1's port merge, the API and socket share one host. Collapse `VITE_WEBSOCKET_URL` into `VITE_BACKEND_URL`.
- **Socket handshake:** SP1 reads `socket.handshake.auth.token` — the client MUST send `auth: { token }` (NOT `extraHeaders`).
- All commands from `app/` unless noted. Keep `npm run build` (`tsc -b && vite build`) and `npm run lint` green at every commit.

---

### Task 1: vitest + PKCE helpers

**Files:**
- Modify: `app/package.json` (devDeps + `test` script)
- Create: `app/vitest.config.ts`
- Create: `app/src/lib/pkce.ts` (verbatim copy)
- Create: `app/src/lib/pkce.test.ts` (adapt eventform's)

- [ ] **Step 1: Install vitest** — `npm install --save-dev vitest` (pre-approved). Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 2: `app/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
});
```

- [ ] **Step 3: Copy `pkce.ts` verbatim** from `/Users/murugappan/personal/eventform/apps/web/src/lib/pkce.ts` into `app/src/lib/pkce.ts` (it's self-contained — no `@/` alias). It exports `generateVerifier`, `challengeFor`, `authorizeUrl`, `exchangeCode`, `refreshTokens`, `CognitoConfig`, `TokenResponse`.

- [ ] **Step 4: Copy & adapt `pkce.test.ts`** from eventform's `apps/web/src/lib/pkce.test.ts` → `app/src/lib/pkce.test.ts`. Fix the import to `from './pkce'`. (It tests verifier length/charset, challenge = base64url(SHA-256(verifier)), and `authorizeUrl` query params — Web Crypto works in node 22's vitest `node` env.)

- [ ] **Step 5: Run** — `npm test` → pkce tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/pkce.ts src/lib/pkce.test.ts
git commit -m "feat: add PKCE helpers + vitest (frontend)"
```

---

### Task 2: env + Cognito config + token store

**Files:**
- Modify: `app/src/env.ts`
- Create: `app/src/lib/auth.ts`

- [ ] **Step 1: Rewrite `app/src/env.ts`**

```ts
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI =
    import.meta.env.VITE_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
const WAKE_URL = import.meta.env.VITE_WAKE_URL;

export { BACKEND_URL, COGNITO_DOMAIN, COGNITO_CLIENT_ID, REDIRECT_URI, WAKE_URL };
```

(Removes `WEBSOCKET_URL` — the socket now uses `BACKEND_URL`.)

- [ ] **Step 2: Create `app/src/lib/auth.ts`** — token storage + Cognito config helpers. The id token is stored under `'token'` (so `fetcher`/`ProtectedRoute` are unchanged); refresh token + email under their own keys.

```ts
import type { CognitoConfig } from './pkce';
import { COGNITO_DOMAIN, COGNITO_CLIENT_ID, REDIRECT_URI } from '../env';

const TOKEN_KEY = 'token'; // the Cognito ID token (Bearer for API + socket)
const REFRESH_KEY = 'chat.refreshToken';
const EMAIL_KEY = 'chat.email';

export const cognitoConfig = (): CognitoConfig => ({
    domain: COGNITO_DOMAIN,
    clientId: COGNITO_CLIENT_ID,
    redirectUri: REDIRECT_URI,
});

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);
export const getEmail = (): string | null => localStorage.getItem(EMAIL_KEY);

export const storeTokens = (idToken: string, refreshToken?: string, email?: string): void => {
    localStorage.setItem(TOKEN_KEY, idToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (email) localStorage.setItem(EMAIL_KEY, email);
};

export const clearTokens = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EMAIL_KEY);
};

// Decode the email claim from a Cognito ID token (no verification — display only).
export const emailFromIdToken = (idToken: string): string | undefined => {
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return typeof payload.email === 'string' ? payload.email : undefined;
    } catch {
        return undefined;
    }
};

export const logout = (): void => {
    clearTokens();
    const qs = new URLSearchParams({
        client_id: COGNITO_CLIENT_ID,
        logout_uri: window.location.origin,
    });
    window.location.href = `${COGNITO_DOMAIN}/logout?${qs}`;
};
```

- [ ] **Step 3: Gate + commit** — `npm run build` (tsc + vite) passes.

```bash
git add src/env.ts src/lib/auth.ts
git commit -m "feat: add Cognito env config + token store helpers"
```

---

### Task 3: PKCE sign-in (Login page)

**Files:**
- Rewrite: `app/src/pages/Login.tsx`

- [ ] **Step 1: Replace `Login.tsx`** with a Google sign-in button that starts the PKCE redirect. Keep the existing tailwind card styling for consistency.

```tsx
import { generateVerifier, challengeFor, authorizeUrl } from '../lib/pkce';
import { cognitoConfig } from '../lib/auth';

export default function LoginPage(): JSX.Element {
    const signIn = async () => {
        const verifier = generateVerifier();
        const challenge = await challengeFor(verifier);
        const state = generateVerifier(); // reuse as random state
        sessionStorage.setItem('chat.pkceVerifier', verifier);
        sessionStorage.setItem('chat.oauthState', state);
        window.location.href = authorizeUrl(cognitoConfig(), challenge, state);
    };

    return (
        <div className="w-full max-w-xs">
            <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 flex flex-col items-center gap-4">
                <h1 className="text-gray-700 font-bold">Chat app</h1>
                <button
                    onClick={signIn}
                    className="bg-blue-500 hover:bg-blue-700 cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    Sign in with Google
                </button>
            </div>
            <p className="text-center text-gray-500 text-xs">
                &copy;2025 Chat app. All rights reserved.
            </p>
        </div>
    );
}
```

- [ ] **Step 2: Gate + commit** — `npm run build` + `npm run lint` pass.

```bash
git add src/pages/Login.tsx
git commit -m "feat: PKCE Google sign-in on the login page"
```

---

### Task 4: Auth callback page + route

**Files:**
- Create: `app/src/pages/AuthCallback.tsx`
- Modify: `app/src/App.tsx` (add public `/auth/callback` route)

**Reference to adapt:** eventform's `apps/web/src/pages/auth-callback.tsx` (the state-validation + code-exchange + StrictMode `ran` ref guard).

- [ ] **Step 1: Create `app/src/pages/AuthCallback.tsx`** — adapt eventform's callback to chat-app (relative imports, store the **id_token** under `'token'`, no `useAuth` context):

```tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { exchangeCode } from '../lib/pkce';
import { cognitoConfig, storeTokens, emailFromIdToken } from '../lib/auth';

export default function AuthCallback(): JSX.Element {
    const navigate = useNavigate();
    const ran = useRef(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (ran.current) return; // StrictMode double-invoke guard
        ran.current = true;
        (async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const returnedState = params.get('state');
            const storedState = sessionStorage.getItem('chat.oauthState');
            const verifier = sessionStorage.getItem('chat.pkceVerifier');
            sessionStorage.removeItem('chat.oauthState');
            sessionStorage.removeItem('chat.pkceVerifier');

            if (!code || !returnedState || returnedState !== storedState || !verifier) {
                setError('Invalid sign-in response. Please try again.');
                return;
            }
            try {
                const tokens = await exchangeCode(cognitoConfig(), code, verifier);
                storeTokens(tokens.id_token, tokens.refresh_token, emailFromIdToken(tokens.id_token));
                navigate('/', { replace: true });
            } catch {
                setError('Sign-in failed. Please try again.');
            }
        })();
    }, [navigate]);

    return (
        <div className="text-gray-600 text-sm">
            {error ? (
                <>
                    <p>{error}</p>
                    <a className="text-blue-500" href="/login">Back to sign in</a>
                </>
            ) : (
                <p>Signing you in…</p>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Add the route in `App.tsx`** — alongside `/login` (public, OUTSIDE `ProtectedRoute`):

```tsx
import AuthCallback from './pages/AuthCallback';
```
```tsx
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />
```

- [ ] **Step 3: Gate + commit** — `npm run build` + `npm run lint`.

```bash
git add src/pages/AuthCallback.tsx src/App.tsx
git commit -m "feat: Cognito auth callback (code exchange + token storage)"
```

---

### Task 5: Socket auth fix + fetcher refresh-on-401

**Files:**
- Modify: `app/src/hooks/useSocket.tsx`
- Modify: `app/src/utils/fetcher.ts`

- [ ] **Step 1: Fix `useSocket.tsx`** — use `auth: { token }` (SP1 reads `socket.handshake.auth.token`) and `BACKEND_URL` (single origin):

```tsx
import { io } from 'socket.io-client';
import { useEffect } from 'react';
import { BACKEND_URL } from '../env';
import { getToken } from '../lib/auth';

export function useSocket() {
    const socket = io(BACKEND_URL, {
        autoConnect: false,
        auth: { token: getToken() },
    });
    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, []);
    return { socket };
}
```

- [ ] **Step 2: Add refresh-on-401 to `fetcher.ts`** — on a 401, try `refreshTokens` once with the stored refresh token; if it succeeds, store the new id token and retry the request once; otherwise clear tokens and redirect to `/login`.

```ts
import { StatusCodes } from 'http-status-codes';
import { BACKEND_URL } from '../env';
import { getToken, getRefreshToken, storeTokens, clearTokens, cognitoConfig, emailFromIdToken } from '../lib/auth';
import { refreshTokens } from '../lib/pkce';

async function tryRefresh(): Promise<boolean> {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
        const t = await refreshTokens(cognitoConfig(), rt);
        // Cognito refresh returns a new id_token (and access), but NOT a new refresh token — keep the old one.
        storeTokens(t.id_token, rt, emailFromIdToken(t.id_token));
        return true;
    } catch {
        return false;
    }
}

const fetcher = async <T>(relativeUrl: string, config: RequestInit = {}): Promise<T> => {
    const doFetch = () =>
        fetch(`${BACKEND_URL}/${relativeUrl}`, {
            ...config,
            headers: {
                ...config.headers,
                accept: 'application/json',
                Authorization: `Bearer ${getToken()}`,
            },
        });

    let res = await doFetch();
    if (res.status === StatusCodes.UNAUTHORIZED && (await tryRefresh())) {
        res = await doFetch(); // retry once with the refreshed id token
    }

    if (res.status === StatusCodes.NO_CONTENT) return undefined as T;
    const apiResponse = await res.json();
    if (!res.ok) {
        if (res.status === StatusCodes.UNAUTHORIZED) {
            clearTokens();
            window.location.href = `${window.location.origin}/login`;
            return undefined as T;
        }
        throw new Error(apiResponse.response.message);
    }
    return apiResponse.response;
};

export default fetcher;
```

- [ ] **Step 3: Gate + commit** — `npm run build` + `npm run lint`.

```bash
git add src/hooks/useSocket.tsx src/utils/fetcher.ts
git commit -m "fix: socket auth via handshake.auth.token; fetcher refresh-on-401"
```

---

### Task 6: ApiHealthGate (wake) + logout wiring

**Files:**
- Create: `app/src/components/ApiHealthGate.tsx`
- Modify: `app/src/App.tsx` (wrap routes)
- Modify: wherever the app has a sign-out affordance (or add one to `Home`) to call `logout()`

**Reference to adapt:** eventform's `apps/web/src/components/api-health-gate.tsx`.

- [ ] **Step 1: Create `app/src/components/ApiHealthGate.tsx`** — on mount, `GET {BACKEND_URL}/health`; if it fails, POST `WAKE_URL` with the id-token Bearer (+ email in the body), show a "waking the server…" state, and poll `/health` (every ~5 s) until OK, then render children. If `WAKE_URL` is unset, just render children (dev). Adapt eventform's component to chat-app's `env`/`auth` (relative imports). Key shape:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { BACKEND_URL, WAKE_URL } from '../env';
import { getToken, getEmail } from '../lib/auth';

async function healthOk(): Promise<boolean> {
    try {
        const r = await fetch(`${BACKEND_URL}/health`);
        return r.ok;
    } catch {
        return false;
    }
}

export default function ApiHealthGate({ children }: { children: ReactNode }): JSX.Element {
    const [ready, setReady] = useState(false);
    const [waking, setWaking] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (await healthOk()) { if (!cancelled) setReady(true); return; }
            if (!WAKE_URL || !getToken()) { if (!cancelled) setReady(true); return; } // can't wake; let normal flow handle it
            setWaking(true);
            try {
                await fetch(WAKE_URL, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', Authorization: `Bearer ${getToken()}` },
                    body: JSON.stringify({ email: getEmail() }),
                });
            } catch { /* ignore; keep polling */ }
            // poll until up
            while (!cancelled) {
                await new Promise((r) => setTimeout(r, 5000));
                if (await healthOk()) { if (!cancelled) { setReady(true); } return; }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    if (ready) return <>{children}</>;
    return (
        <div className="flex items-center justify-center min-h-screen text-gray-600">
            {waking ? 'Waking the server… this can take a moment.' : 'Connecting…'}
        </div>
    );
}
```

> Note: the wake endpoint is Cognito-JWT-gated, so it only works when signed in. On the public `/login` route there's no token — the gate should NOT block sign-in. Wrap only the PROTECTED area (see Step 2), not `/login` or `/auth/callback`.

- [ ] **Step 2: Wrap the protected routes in `App.tsx`** — put `ApiHealthGate` around the `ProtectedRoute` element (or the protected `<Route>` group), leaving `/login` and `/auth/callback` outside it:

```tsx
<Route element={<ApiHealthGate><ProtectedRoute /></ApiHealthGate>}>
    <Route index element={<Home />} />
    <Route path="chat/:chatId" element={<Chat />} />
</Route>
```

- [ ] **Step 3: Wire logout** — add a sign-out control (e.g. a button in `Home`) that calls `logout()` from `../lib/auth`.

- [ ] **Step 4: Gate + commit** — `npm run build` + `npm run lint`.

```bash
git add src/components/ApiHealthGate.tsx src/App.tsx src/pages/Home.tsx
git commit -m "feat: ApiHealthGate wakes the backend; wire logout"
```

---

### Task 7: Cloudflare Pages config + docs

**Files:**
- Create: `app/public/_redirects`
- Modify: `docs/DEPLOYMENT.md` (frontend / Cloudflare Pages section)

- [ ] **Step 1: SPA fallback** — `app/public/_redirects`:

```
/*    /index.html   200
```

- [ ] **Step 2: Document the Pages setup** in `docs/DEPLOYMENT.md` (a new "Frontend — Cloudflare Pages" section): connect the repo, build command `npm run build`, build output dir `app/dist`, root dir `app`; set env vars `VITE_BACKEND_URL=https://chat-api.murugappan.dev`, `VITE_COGNITO_DOMAIN=https://auth.murugappan.dev`, `VITE_COGNITO_CLIENT_ID=5c32fqvmu4fmta044ut5udm6j1`, `VITE_REDIRECT_URI=https://chat.murugappan.dev/auth/callback`, `VITE_WAKE_URL=<ComputeStack WakeUrl output>`; the Cognito app client already lists `https://chat.murugappan.dev/auth/callback` as a callback URL. Note the production domain (`chat.murugappan.dev`) must match the registered callback + the CORS origin (SP1).

- [ ] **Step 3: Gate + commit** — `npm run build` (confirm `_redirects` is copied to `dist`).

```bash
git add app/public/_redirects docs/DEPLOYMENT.md
git commit -m "feat: Cloudflare Pages SPA fallback + frontend deploy docs"
```

---

## Self-Review

- PKCE helpers + test (decision: pinned Google in `authorizeUrl`) → Task 1. ✓
- id token stored as `'token'`, refresh + email stored → Task 2; callback stores them → Task 4. ✓
- PKCE sign-in → Task 3; callback exchange → Task 4. ✓
- Socket `auth:{token}` fix + single origin (SP1 integration bug) → Task 5 Step 1. ✓
- Refresh-on-401 (decision #1) → Task 5 Step 2. ✓
- ApiHealthGate wake (scale-to-zero) wrapping only protected routes → Task 6. ✓
- Logout → Task 6 Step 3. ✓
- Cloudflare Pages (_redirects + env + docs) → Task 7. ✓
- Gates: vitest (pkce) + `npm run build` (tsc+vite) + `npm run lint` each task. ✓

## Not in this plan (operator)
The Cloudflare Pages dashboard setup, the `VITE_*` values, and pointing `chat.murugappan.dev` at Pages — operator, per DEPLOYMENT.md. The `chat-api.murugappan.dev` tunnel hostname comes from SP4's deploy.
