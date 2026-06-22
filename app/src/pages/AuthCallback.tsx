import { useEffect, useRef, useState, type JSX} from 'react';
import { useNavigate } from 'react-router';
import { exchangeCode } from '../lib/pkce';
import { cognitoConfig, storeTokens, emailFromIdToken, pictureFromIdToken } from '../lib/auth';

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
                storeTokens(tokens.id_token, tokens.refresh_token, emailFromIdToken(tokens.id_token), pictureFromIdToken(tokens.id_token));
                navigate('/chat', { replace: true });
            } catch {
                setError('Sign-in failed. Please try again.');
            }
        })();
    }, [navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
            {error ? (
                <div className="flex flex-col items-center gap-2">
                    <p>{error}</p>
                    <a className="text-primary underline" href="/login">Back to sign in</a>
                </div>
            ) : (
                <p>Signing you in…</p>
            )}
        </div>
    );
}
