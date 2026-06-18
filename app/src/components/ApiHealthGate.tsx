import { useEffect, useState, type ReactNode, type JSX} from 'react';
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
        <div className="flex items-center justify-center min-h-screen text-muted-foreground">
            {waking ? 'Waking the server… this can take a moment.' : 'Connecting…'}
        </div>
    );
}
