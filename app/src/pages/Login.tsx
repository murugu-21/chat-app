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
