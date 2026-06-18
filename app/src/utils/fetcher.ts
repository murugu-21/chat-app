import { StatusCodes } from 'http-status-codes';
import { BACKEND_URL } from '../env';
import { getToken, getRefreshToken, storeTokens, clearTokens, cognitoConfig, emailFromIdToken } from '../lib/auth';
import { refreshTokens } from '../lib/pkce';

async function tryRefresh(): Promise<boolean> {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
        const t = await refreshTokens(cognitoConfig(), rt);
        // Cognito refresh returns a new id_token (and access), but NOT a new refresh token — keep the old one.
        storeTokens(t.id_token, rt, emailFromIdToken(t.id_token));
        return true;
    } catch {
        return false;
    }
}

const fetcher = async <T>(relativeUrl: string, config: RequestInit = {}): Promise<T> => {
    const doFetch = () =>
        fetch(`${BACKEND_URL}/${relativeUrl}`, {
            ...config,
            headers: {
                ...config.headers,
                accept: 'application/json',
                Authorization: `Bearer ${getToken()}`,
            },
        });

    let res = await doFetch();
    if (res.status === StatusCodes.UNAUTHORIZED && (await tryRefresh())) {
        res = await doFetch(); // retry once with the refreshed id token
    }

    if (res.status === StatusCodes.NO_CONTENT) return undefined as T;
    const apiResponse = await res.json();
    if (!res.ok) {
        if (res.status === StatusCodes.UNAUTHORIZED) {
            clearTokens();
            window.location.href = `${window.location.origin}/login`;
            return undefined as T;
        }
        throw new Error(apiResponse.response.message);
    }
    return apiResponse.response;
};

export default fetcher;
