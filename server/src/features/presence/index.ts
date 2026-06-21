import type { Redis } from 'ioredis';

import { redisClient } from '../../lib/redis/index.js';
import { makeMemoryPresence } from './presence.memory.js';
import { makeRedisPresence } from './presence.redis.js';
import type { Presence } from './types.js';

// Redis when a client exists, otherwise in-memory.
export const selectPresence = (client: Redis | null): Presence => {
    return client ? makeRedisPresence(client) : makeMemoryPresence();
};

export const presence: Presence = selectPresence(redisClient);
