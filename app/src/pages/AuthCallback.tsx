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
