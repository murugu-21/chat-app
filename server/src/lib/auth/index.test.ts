import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
    NODE_ENV: 'test',
    ADMIN_API_KEY: '00000000-0000-0000-0000-000000000000',
    PORT: '3000',
    DATABASE_URL: 'mongodb://localhost:27017',
    AWS_REGION: 'ap-south-1',
    CLIENT_URL: 'http://localhost:5173',
    SENTRY_DSN: 'https://abc@o0.ingest.sentry.io/0',
    NOTIFICATIONS_EMAIL: 'no-reply@example.com',
    JWT_SECRET: '00000000-0000-0000-0000-000000000000',
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
});
