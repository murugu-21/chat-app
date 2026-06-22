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
