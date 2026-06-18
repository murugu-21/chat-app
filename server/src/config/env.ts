import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
    server: {
        NODE_ENV: z.enum(['local', 'dev', 'prod', 'test']),
        ADMIN_API_KEY: z.string().uuid(),
        PORT: z.coerce.number().min(0).max(9999),
        DATABASE_URL: z.string(),
        CLIENT_URL: z.string().url(),
        SENTRY_DSN: z.string().url(),
        AUTH_MODE: z.enum(['dev', 'cognito']),
        COGNITO_ISSUER: z.string().url().optional(),
        COGNITO_CLIENT_ID: z.string().optional(),
    },
    runtimeEnv: process.env,
});

export default env;
