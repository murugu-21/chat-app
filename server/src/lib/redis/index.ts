import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

import env from '../../config/env.js';

// One ioredis client when REDIS_URL is set (rediss:// enables TLS automatically),
// or null to signal the in-memory fallback. ioredis auto-reconnects; log errors
// to stderr rather than crashing the process.
export const redisClient: Redis | null = env.REDIS_URL
    ? new Redis(env.REDIS_URL)
    : null;

redisClient?.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[redis] client error:', err.message);
});

// Socket.IO Redis adapter factory. The adapter needs a pub client (this one) and
// a sub client (a duplicate, used in subscriber mode). Pure + unit-testable.
export const makeSocketRedisAdapter = (client: Redis) =>
    createAdapter(client, client.duplicate());
