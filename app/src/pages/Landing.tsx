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
