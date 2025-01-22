import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
  server: {
    NODE_ENV: z.enum(['local', 'dev', 'prod', 'test']),
    ADMIN_API_KEY: z.string().uuid(),
    PORT: z.coerce.number().min(0).max(9999),
  },
  runtimeEnv: process.env,
});

export default env;
