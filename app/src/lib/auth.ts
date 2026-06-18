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
