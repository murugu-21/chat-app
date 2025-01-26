import { StatusCodes } from 'http-status-codes';
import { BACKEND_URL } from '../env';

const fetcher = async <T>(
    relativeUrl: string,
    config: RequestInit = {}
): Promise<T> => {
    // uncomment to verify loaders
    // await new Promise((resolve) => setTimeout(() => resolve(""), 5 * 1000))
    
    // uncomment to verify error handling
    // if(config.method === 'POST')
    // throw new Error("custom error")
    const res = await fetch(
        `${BACKEND_URL}/${relativeUrl}`,
        {
            ...config,
            headers: {
                ...config.headers,
                accept: 'application/json',
                Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
        }
    );
    if (res.status === StatusCodes.NO_CONTENT) {
        // if no content, assume Generic Type is undefined, else user has to handle in code
        return undefined as T;
    }
    const apiResponse = await res.json();
    if (!res.ok) {
        if (res.status === StatusCodes.UNAUTHORIZED) {
            localStorage.removeItem('token');
            window.location.href = `${window.location.origin}/login`;
            return undefined as T;
        }
        throw new Error(apiResponse.response.message);
    }
    return apiResponse.response;
};

export default fetcher;
