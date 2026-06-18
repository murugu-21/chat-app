import type { JSX } from 'react';
import { generateVerifier, challengeFor, authorizeUrl } from '@/lib/pkce';
import { cognitoConfig } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
