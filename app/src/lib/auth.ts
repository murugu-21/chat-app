import { generateVerifier, challengeFor, authorizeUrl, type CognitoConfig } from './pkce';
import { COGNITO_DOMAIN, COGNITO_CLIENT_ID, REDIRECT_URI } from '../env';

const TOKEN_KEY = 'token'; // the Cognito ID token (Bearer for API + socket)
const REFRESH_KEY = 'chat.refreshToken';
const EMAIL_KEY = 'chat.email';
const PICTURE_KEY = 'chat.picture';

export const cognitoConfig = (): CognitoConfig => ({
    domain: COGNITO_DOMAIN,
    clientId: COGNITO_CLIENT_ID,
    redirectUri: REDIRECT_URI,
});

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

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_KEY);
export const getEmail = (): string | null => localStorage.getItem(EMAIL_KEY);
export const getPicture = (): string | null => localStorage.getItem(PICTURE_KEY);

export const storeTokens = (idToken: string, refreshToken?: string, email?: string, picture?: string): void => {
    localStorage.setItem(TOKEN_KEY, idToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (email) localStorage.setItem(EMAIL_KEY, email);
    if (picture) localStorage.setItem(PICTURE_KEY, picture);
};

export const clearTokens = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(PICTURE_KEY);
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

export const pictureFromIdToken = (idToken: string): string | undefined => {
    try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        return typeof payload.picture === 'string' ? payload.picture : undefined;
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
