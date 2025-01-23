import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
    server: {
        NODE_ENV: z.enum(['local', 'dev', 'prod', 'test']),
        ADMIN_API_KEY: z.string().uuid(),
        PORT: z.coerce.number().min(0).max(9999),
        WEBSOCKET_PORT: z.coerce.number().min(0).max(9999),
        DATABASE_URL: z.string(),
        AWS_REGION: z.enum(['ap-south-1']),
        CLIENT_URL: z.string().url(),
        SENTRY_DSN: z.string().url(),
        NOTIFICATIONS_EMAIL: z.string().email(),
        JWT_SECRET: z.string().uuid(),
    },
    runtimeEnv: process.env,
});

export default env;
