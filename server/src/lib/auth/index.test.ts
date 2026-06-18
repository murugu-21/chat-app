import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
    NODE_ENV: 'test',
    ADMIN_API_KEY: '00000000-0000-0000-0000-000000000000',
    PORT: '3000',
    DATABASE_URL: 'mongodb://localhost:27017',
    CLIENT_URL: 'http://localhost:5173',
    SENTRY_DSN: 'https://abc@o0.ingest.sentry.io/0',
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('verifyToken instance', () => {
    it('verifies dev tokens when AUTH_MODE=dev', async () => {
        for (const [k, v] of Object.entries({ ...baseEnv, AUTH_MODE: 'dev' })) {
            vi.stubEnv(k, v);
        }
        const { verifyToken } = await import('./index.js');
        await expect(verifyToken('dev_x@y.com')).resolves.toMatchObject({ email: 'x@y.com' });
    });

    it('throws on boot when NODE_ENV=prod and AUTH_MODE=dev', async () => {
        for (const [k, v] of Object.entries({ ...baseEnv, NODE_ENV: 'prod', AUTH_MODE: 'dev' })) {
            vi.stubEnv(k, v);
        }
        await expect(import('./index.js')).rejects.toThrow(/forbidden/);
    });

    it('does NOT throw when NODE_ENV=prod and AUTH_MODE=cognito with required vars', async () => {
        for (const [k, v] of Object.entries({
            ...baseEnv,
            NODE_ENV: 'prod',
            AUTH_MODE: 'cognito',
            COGNITO_ISSUER: 'https://cognito-idp.us-east-1.amazonaws.com/pool_123',
            COGNITO_CLIENT_ID: 'client_abc',
        })) {
            vi.stubEnv(k, v);
        }
        const { verifyToken } = await import('./index.js');
        expect(typeof verifyToken).toBe('function');
    });
});
