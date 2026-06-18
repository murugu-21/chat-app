# shadcn UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the chat-app SPA UI with shadcn/ui — a modern two-pane messaging layout (sidebar + threaded bubbles), light/dark toggle — changing presentation only, not data/auth/socket behavior.

**Architecture:** shadcn on the existing Tailwind v4 setup. A `ChatLayout` route renders a persistent sidebar + `<Outlet/>`; the thread renders sender-aligned bubbles. All SWR/socket/PKCE behavior is preserved.

**Tech Stack:** React 18, react-router 7, Vite, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui, next-themes, lucide-react.

## Global Constraints

- **Presentation only.** Do not change SWR keys (`chat/list`, `user/search`, `message/list/:id`), the socket `join`/`leave`/`message` lifecycle, `fetcher` (+ refresh-on-401), PKCE auth, or the `ApiHealthGate`/`ProtectedRoute` wrappers. Data shapes unchanged: chats `{chatId, chatName}` (chatName = peer email), messages `{_id, content, createdBy:{email}}`, search `{_id, email}`.
- **Base palette:** zinc. **Style:** new-york. **Icons:** lucide. **CSS variables:** yes.
- **Path alias `@/` → `src/`.** All new imports use `@/…`.
- **Light + dark** via next-themes (`attribute="class"`, `defaultTheme="system"`).
- **"You" in the thread** = `message.createdBy.email === getEmail()` (from `@/lib/auth`).
- Keep each commit green: `npm run build` (`tsc -b && vite build`) + `npm run lint`. The dev server is running for visual checks (hot-reload).
- All commands run from `app/`.

---

### Task 1: shadcn foundation + theme + dark mode

**Files:**
- Modify: `app/vite.config.ts` (add `@` alias)
- Modify: `app/tsconfig.app.json` and `app/tsconfig.json` (add `baseUrl` + `paths`)
- Create: `app/components.json`
- Create: `app/src/lib/utils.ts` (move `cn`)
- Modify: `app/src/index.css` (replace with shadcn Tailwind v4 theme)
- Create (via CLI): `app/src/components/ui/*`
- Create: `app/src/components/theme/theme-provider.tsx`, `app/src/components/theme/mode-toggle.tsx`
- Modify: `app/src/main.tsx` (wrap in `ThemeProvider`)

**Interfaces:**
- Produces: `cn` at `@/lib/utils`; shadcn ui components at `@/components/ui/*`; `ThemeProvider`, `ModeToggle`.

- [ ] **Step 1: Add the `@` alias to `vite.config.ts`** (use `fileURLToPath` to avoid needing `@types/node`):

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});
```

- [ ] **Step 2: Add `baseUrl` + `paths` to `tsconfig.app.json`** — inside `compilerOptions`:

```json
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
```

And add the same `compilerOptions` block to `app/tsconfig.json` (so the shadcn CLI resolves the alias). `tsconfig.json` currently has `"files": []` + `references`; add:

```json
  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } },
```

- [ ] **Step 3: Create `app/src/lib/utils.ts`** (shadcn's `cn` location):

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
```

(Leave `src/utils/cnHelper.ts` for now; it's removed in Task 5 after imports migrate.)

- [ ] **Step 4: Create `app/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 5: Replace `app/src/index.css`** with the shadcn Tailwind-v4 theme (zinc). Full file:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.705 0.015 286.067);
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.21 0.006 285.885);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.21 0.006 285.885);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.92 0.004 286.32);
  --primary-foreground: oklch(0.21 0.006 285.885);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --accent: oklch(0.274 0.006 286.033);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.552 0.016 285.938);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; margin: 0; min-height: 100vh; }
}
```

Also delete the `#root { max-width:1280px; text-align:center; … }` rule from `app/src/App.css` (it centers/!constrains everything) — set `app/src/App.css` to empty or remove its import. (App.tsx imports `./App.css`; leaving it empty is fine.)

- [ ] **Step 6: Add shadcn components via the CLI** (non-interactive; installs radix + cva + tw-animate-css + lucide-react automatically):

Run:
```bash
npx shadcn@latest add button input textarea card avatar scroll-area dropdown-menu separator skeleton sonner tooltip --yes
```
Expected: files created under `src/components/ui/`; deps added to `package.json`. If the CLI prompts despite `--yes` or fails on Tailwind v4 detection, STOP and report (do not hand-roll silently).

- [ ] **Step 7: Create `src/components/theme/theme-provider.tsx`**

```tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
        </NextThemesProvider>
    );
}
```

- [ ] **Step 8: Create `src/components/theme/mode-toggle.tsx`**

```tsx
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function ModeToggle() {
    const { setTheme } = useTheme();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

- [ ] **Step 9: Wrap the app in `main.tsx`** — wrap `<App/>` with `<ThemeProvider>`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme/theme-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
```

- [ ] **Step 10: Gate + commit**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors. Visually: existing pages render re-themed; the dev server hot-reloads.

```bash
git add app/vite.config.ts app/tsconfig.app.json app/tsconfig.json app/components.json app/src/lib/utils.ts app/src/index.css app/src/App.css app/src/components/ui app/src/components/theme app/src/main.tsx app/package.json app/package-lock.json
git commit -m "feat(ui): shadcn foundation — alias, zinc theme, dark mode, ui components"
```

---

### Task 2: App shell — ChatLayout + Sidebar + routing

**Files:**
- Create: `app/src/layouts/ChatLayout.tsx`
- Create: `app/src/components/chat/Sidebar.tsx`, `ConversationList.tsx`, `UserSearch.tsx`, `EmptyState.tsx`
- Modify: `app/src/App.tsx` (layout route)
- Modify: `app/src/pages/Home.tsx` → becomes the index empty-state (or replaced by `EmptyState`)

**Interfaces:**
- Consumes: `fetcher` (`@/utils/fetcher`), `getEmail`/`logout` (`@/lib/auth`), shadcn ui.
- Produces: `ChatLayout` (sidebar + `<Outlet/>`).

- [ ] **Step 1: `ConversationList.tsx`** — fetches `chat/list`, renders rows; active row from `useParams().chatId`.

```tsx
import useSWR from 'swr';
import { useNavigate, useParams } from 'react-router';
import fetcher from '@/utils/fetcher';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

type Chat = { chatId: string; chatName: string };

export function ConversationList() {
    const { data: chats, isLoading } = useSWR<Chat[]>('chat/list', fetcher);
    const navigate = useNavigate();
    const { chatId: activeId } = useParams();

    if (isLoading) {
        return (
            <div className="space-y-1 p-2">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <nav className="flex-1 overflow-y-auto p-2">
            {(chats ?? []).map((chat) => (
                <button
                    key={chat.chatId}
                    onClick={() => navigate(`/chat/${chat.chatId}`)}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent',
                        chat.chatId === activeId && 'bg-accent',
                    )}
                >
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>{chat.chatName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{chat.chatName}</span>
                </button>
            ))}
        </nav>
    );
}
```

- [ ] **Step 2: `UserSearch.tsx`** — the existing search-by-email + create-chat flow, styled.

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import fetcher from '@/utils/fetcher';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z.object({ query: z.string().min(3) });
type Form = z.infer<typeof schema>;
type User = { _id: string; email: string };
type Chat = { chatId: string; chatName: string };

export function UserSearch() {
    const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
    const [users, setUsers] = useState<User[]>([]);
    const navigate = useNavigate();
    const { data: chats } = useSWR<Chat[]>('chat/list', fetcher);

    const onSubmit = handleSubmit(async (data) => {
        setUsers(await fetcher<User[]>('user/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }));
    });

    const startChat = async (user: User) => {
        const existing = (chats ?? []).find((c) => c.chatName === user.email);
        const chatId = existing?.chatId ?? await fetcher<string>('chat/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
        });
        navigate(`/chat/${chatId}`);
    };

    return (
        <div className="border-b p-3">
            <form onSubmit={onSubmit} className="flex gap-2">
                <Input placeholder="Search users by email…" {...register('query')} />
                <Button type="submit" size="sm">Search</Button>
            </form>
            {errors.query && <p className="mt-1 text-xs text-destructive">{errors.query.message}</p>}
            {users.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {users.map((u) => (
                        <li key={u._id} className="flex items-center justify-between gap-2 rounded-md p-1 text-sm">
                            <span className="truncate">{u.email}</span>
                            <Button size="sm" variant="secondary" onClick={() => startChat(u)}>Message</Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

- [ ] **Step 3: `Sidebar.tsx`** — header (title + ModeToggle + avatar/sign-out dropdown), `UserSearch`, `ConversationList`.

```tsx
import { LogOut } from 'lucide-react';
import { getEmail, logout } from '@/lib/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ModeToggle } from '@/components/theme/mode-toggle';
import { UserSearch } from './UserSearch';
import { ConversationList } from './ConversationList';

export function Sidebar() {
    const email = getEmail() ?? 'You';
    return (
        <aside className="flex h-full w-full flex-col border-r bg-background md:w-80">
            <div className="flex items-center justify-between border-b p-3">
                <span className="font-semibold">Chat app</span>
                <div className="flex items-center gap-1">
                    <ModeToggle />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Avatar className="h-7 w-7"><AvatarFallback>{email.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => logout()}>
                                <LogOut className="mr-2 h-4 w-4" /> Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <UserSearch />
            <ConversationList />
        </aside>
    );
}
```

- [ ] **Step 4: `EmptyState.tsx`** (index pane when no chat selected)

```tsx
import { MessageSquare } from 'lucide-react';

export default function EmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p>Select a conversation to start chatting</p>
        </div>
    );
}
```

- [ ] **Step 5: `ChatLayout.tsx`** — two-pane shell. (Responsive refinement lands in Task 5; here, render sidebar + outlet side by side.)

```tsx
import { Outlet } from 'react-router';
import { Sidebar } from '@/components/chat/Sidebar';

export default function ChatLayout() {
    return (
        <div className="flex h-screen w-full overflow-hidden">
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
```

- [ ] **Step 6: Rewire routing in `App.tsx`** — wrap the protected area in `ChatLayout`; `index` → `EmptyState`, `chat/:chatId` → `Chat`. Keep `/login` + `/auth/callback` public, and keep `ApiHealthGate`+`ProtectedRoute`:

```tsx
<Route element={<ApiHealthGate><ProtectedRoute /></ApiHealthGate>}>
    <Route element={<ChatLayout />}>
        <Route index element={<EmptyState />} />
        <Route path="chat/:chatId" element={<Chat />} />
    </Route>
</Route>
```
Add imports for `ChatLayout` (`@/layouts/ChatLayout`) and `EmptyState` (`@/components/chat/EmptyState`); remove the now-unused `Home` import (Home is superseded by the sidebar + EmptyState).

- [ ] **Step 7: Gate + commit**

Run: `npm run build && npm run lint`
Expected: green. Visually: sidebar with search + conversation list; clicking a conversation navigates; index shows the empty state.

```bash
git add app/src/layouts app/src/components/chat/Sidebar.tsx app/src/components/chat/ConversationList.tsx app/src/components/chat/UserSearch.tsx app/src/components/chat/EmptyState.tsx app/src/App.tsx
git rm app/src/pages/Home.tsx
git commit -m "feat(ui): persistent sidebar shell + conversation list + user search"
```

---

### Task 3: Message thread — bubbles + composer

**Files:**
- Create: `app/src/lib/isMine.ts`
- Test: `app/src/lib/isMine.test.ts`
- Create: `app/src/components/chat/ChatHeader.tsx`, `MessageBubble.tsx`, `MessageList.tsx`, `Composer.tsx`
- Modify: `app/src/pages/Chat.tsx` (rewrite to compose them)

**Interfaces:**
- Consumes: `fetcher`, `useSocket`, `getEmail`, shadcn ui.
- Produces: `isMine(message, email)`.

- [ ] **Step 1: Write the failing test** — `src/lib/isMine.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { isMine } from './isMine';

describe('isMine', () => {
    it('true when the message sender matches my email', () => {
        expect(isMine({ createdBy: { email: 'me@x.com' } }, 'me@x.com')).toBe(true);
    });
    it('false for a different sender', () => {
        expect(isMine({ createdBy: { email: 'them@x.com' } }, 'me@x.com')).toBe(false);
    });
    it('false when my email is null', () => {
        expect(isMine({ createdBy: { email: 'them@x.com' } }, null)).toBe(false);
    });
});
```

- [ ] **Step 2: Run (RED)** — `npm test -- isMine` → fails (no module).

- [ ] **Step 3: Implement** — `src/lib/isMine.ts`

```ts
export const isMine = (
    message: { createdBy: { email: string } },
    myEmail: string | null,
): boolean => myEmail != null && message.createdBy.email === myEmail;
```

- [ ] **Step 4: Run (GREEN)** — `npm test -- isMine` → 3 pass.

- [ ] **Step 5: `MessageBubble.tsx`**

```tsx
import { cn } from '@/lib/utils';

export function MessageBubble({ content, mine }: { content: string; mine: boolean }) {
    return (
        <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words',
                mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            )}>
                {content}
            </div>
        </div>
    );
}
```

- [ ] **Step 6: `MessageList.tsx`** — scrollable, auto-scroll to newest.

```tsx
import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { isMine } from '@/lib/isMine';
import { getEmail } from '@/lib/auth';

type Message = { _id: string; content: string; createdBy: { email: string } };

export function MessageList({ messages }: { messages: Message[] }) {
    const myEmail = getEmail();
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
    return (
        <ScrollArea className="flex-1 px-4 py-4">
            <div className="flex flex-col gap-2">
                {messages.map((m) => (
                    <MessageBubble key={m._id} content={m.content} mine={isMine(m, myEmail)} />
                ))}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}
```

- [ ] **Step 7: `Composer.tsx`** — Textarea + send; Enter sends, Shift+Enter newline.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SendHorizontal } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const schema = z.object({ content: z.string().min(1) });
type Form = z.infer<typeof schema>;

export function Composer({ onSend }: { onSend: (content: string) => Promise<void> }) {
    const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
    const submit = handleSubmit(async ({ content }) => { await onSend(content); reset(); });
    return (
        <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
            <Textarea
                {...register('content')}
                placeholder="Type a message…"
                rows={1}
                className="min-h-10 max-h-40 resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            />
            <Button type="submit" size="icon" disabled={isSubmitting}><SendHorizontal className="h-4 w-4" /></Button>
        </form>
    );
}
```

- [ ] **Step 8: `ChatHeader.tsx`**

```tsx
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function ChatHeader({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-3 border-b p-3">
            <Avatar className="h-8 w-8"><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <span className="font-medium">{name}</span>
        </div>
    );
}
```

- [ ] **Step 9: Rewrite `Chat.tsx`** to compose the above, preserving all data/socket logic. (The peer name comes from the matching `chat/list` entry's `chatName`.)

```tsx
import { useParams } from 'react-router';
import useSWR from 'swr';
import { useEffect } from 'react';
import fetcher from '@/utils/fetcher';
import { useSocket } from '@/hooks/useSocket';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { Composer } from '@/components/chat/Composer';
import { Skeleton } from '@/components/ui/skeleton';
import SiteDown from './utils/SiteDown';

type Message = { _id: string; content: string; createdBy: { email: string } };
type Chat = { chatId: string; chatName: string };

export default function Chat(): JSX.Element {
    const { socket } = useSocket();
    const { chatId } = useParams();
    const { data: messages, isLoading, error, mutate } =
        useSWR<Message[]>(chatId ? `message/list/${chatId}` : null, fetcher);
    const { data: chats } = useSWR<Chat[]>('chat/list', fetcher);
    const name = (chats ?? []).find((c) => c.chatId === chatId)?.chatName ?? 'Conversation';

    useEffect(() => {
        socket.emit('join', chatId);
        socket.on('message', () => { mutate(); });
        return () => { socket.emit('leave', chatId); socket.off('message'); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

    const send = async (content: string) => {
        await fetcher('message/send', {
            method: 'POST',
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ chatId, content }),
        });
    };

    if (!chatId) return <SiteDown />;
    if (isLoading) return <div className="flex-1 space-y-3 p-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-64 ml-auto" /></div>;
    if (error || !messages) return <SiteDown />;

    return (
        <div className="flex h-full flex-col">
            <ChatHeader name={name} />
            <MessageList messages={messages} />
            <Composer onSend={send} />
        </div>
    );
}
```

- [ ] **Step 10: Gate + commit**

Run: `npm test -- isMine && npm run build && npm run lint`
Expected: isMine 3 pass; build green. Visually: bubbles align by sender, Enter sends, new messages appear via socket.

```bash
git add app/src/lib/isMine.ts app/src/lib/isMine.test.ts app/src/components/chat/ChatHeader.tsx app/src/components/chat/MessageBubble.tsx app/src/components/chat/MessageList.tsx app/src/components/chat/Composer.tsx app/src/pages/Chat.tsx
git commit -m "feat(ui): threaded message bubbles + composer (Enter-to-send)"
```

---

### Task 4: Login + utility pages

**Files:**
- Modify: `app/src/pages/Login.tsx`
- Modify: `app/src/pages/AuthCallback.tsx` (center it; use Skeleton/spinner cleanly)
- Modify: `app/src/pages/utils/NotFound.tsx`, `NoInternet.tsx`, `SiteDown.tsx`, `FullPageLoader.tsx`

- [ ] **Step 1: Rewrite `Login.tsx`** — centered `Card`, keep the PKCE redirect logic (from SP2) intact, restyle with shadcn:

```tsx
import { generateVerifier, challengeFor, authorizeUrl } from '@/lib/pkce';
import { cognitoConfig } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage(): JSX.Element {
    const signIn = async () => {
        const verifier = generateVerifier();
        const challenge = await challengeFor(verifier);
        const state = generateVerifier();
        sessionStorage.setItem('chat.pkceVerifier', verifier);
        sessionStorage.setItem('chat.oauthState', state);
        window.location.href = authorizeUrl(cognitoConfig(), challenge, state);
    };
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Chat app</CardTitle>
                    <CardDescription>Sign in to continue</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className="w-full" onClick={signIn}>Continue with Google</Button>
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 2: Center `AuthCallback.tsx`** — wrap its returned markup in `<div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">…</div>` (keep all exchange logic from SP2 unchanged — only the wrapper className changes).

- [ ] **Step 3: Restyle the utility pages** — give each a centered `Card` + lucide icon + message. Example `NotFound.tsx`:

```tsx
import { FileQuestion } from 'lucide-react';
export default function NotFound(): JSX.Element {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p>Page not found</p>
        </div>
    );
}
```
Apply the same pattern to `NoInternet.tsx` (icon `WifiOff`, "You're offline") and `SiteDown.tsx` (icon `ServerCrash`, "Something went wrong"). For `FullPageLoader.tsx`, render a centered `Skeleton` block or a `lucide` `Loader2` with `animate-spin`:
```tsx
import { Loader2 } from 'lucide-react';
export default function FullPageLoader(): JSX.Element {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
```
(Match each file's existing default/named export style — check before editing.)

- [ ] **Step 4: Gate + commit**

Run: `npm run build && npm run lint`
Expected: green. Visually: polished login + util pages in both themes.

```bash
git add app/src/pages/Login.tsx app/src/pages/AuthCallback.tsx app/src/pages/utils
git commit -m "feat(ui): restyle login + utility pages with shadcn"
```

---

### Task 5: Responsive + cleanup

**Files:**
- Modify: `app/src/layouts/ChatLayout.tsx` (mobile list↔thread)
- Delete: `app/src/components/Button.tsx`, `Toast.tsx`, `LoadingSpinner.tsx`, `app/src/utils/cnHelper.ts` (if no longer imported)

- [ ] **Step 1: Make `ChatLayout` responsive** — on mobile, show the sidebar OR the thread (not both), driven by whether a chat is selected:

```tsx
import { Outlet, useParams } from 'react-router';
import { Sidebar } from '@/components/chat/Sidebar';
import { cn } from '@/lib/utils';

export default function ChatLayout() {
    const { chatId } = useParams();
    return (
        <div className="flex h-screen w-full overflow-hidden">
            <div className={cn('w-full md:w-80 md:block', chatId && 'hidden md:block')}>
                <Sidebar />
            </div>
            <main className={cn('flex-1 flex-col overflow-hidden', chatId ? 'flex' : 'hidden md:flex')}>
                <Outlet />
            </main>
        </div>
    );
}
```
And in `ChatHeader.tsx`, add a back button visible only on mobile that navigates to `/`:
```tsx
// at the top of the header row, before the avatar:
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
// inside the component:
const navigate = useNavigate();
// JSX (first child of the header div):
<Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/')}><ChevronLeft className="h-4 w-4" /></Button>
```

- [ ] **Step 2: Find and remove dead components** — confirm nothing imports the old custom components, then delete:

```bash
grep -rn "components/Button\|components/Toast\|components/LoadingSpinner\|utils/cnHelper" src || echo "no importers"
```
If `no importers` (migrate any stragglers to shadcn `Button`/`sonner`/`@/lib/utils` first), then:
```bash
git rm src/components/Button.tsx src/components/Toast.tsx src/components/LoadingSpinner.tsx src/utils/cnHelper.ts
```
(If `LoadingSpinner`/`Toast` are still referenced by something out of scope, leave them and note it.)

- [ ] **Step 3: Gate + commit**

Run: `npm run build && npm run lint && npm test`
Expected: green; pkce + isMine tests pass. Visually: on a narrow viewport, selecting a chat swaps to the thread with a back button.

```bash
git add -A
git commit -m "feat(ui): responsive list↔thread + remove superseded components"
```

---

## Self-Review

- Foundation/theme/dark mode (spec §Foundation) → Task 1. ✓
- shadcn components (§components) → Task 1 Step 6. ✓
- Sidebar + conversation list + user search + routing restructure (§Layout) → Task 2. ✓
- Thread bubbles + sender alignment via `getEmail` + composer (§Thread) → Task 3 (+ `isMine` test). ✓
- Login + util pages + loaders (§Login) → Task 4. ✓
- Responsive list↔thread (§Responsive) → Task 5. ✓
- Preserved behavior (SWR/socket/PKCE) — every task keeps the existing data calls; only presentation changes. ✓
- Placeholder scan: shadcn `ui/*` internals are CLI-generated (not transcribed) — acceptable; all hand-written code is complete. ✓
- Type consistency: `isMine(message, myEmail)`, `getEmail(): string | null`, chat `{chatId, chatName}`, message `{_id, content, createdBy:{email}}` consistent across tasks. ✓

## Not in this plan
Backend changes; new chat features (groups, attachments, typing, read receipts); Storybook.
