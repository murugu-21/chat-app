import type { Redis } from 'ioredis';

import type { Presence } from './types.js';

const KEY = 'presence:counts';

// Redis-backed presence: a single hash mapping email -> active connection count.
// Connection counting handles multiple tabs/devices across instances.
export const makeRedisPresence = (client: Redis): Presence => ({
    async addConnection(email) {
        const next = await client.hincrby(KEY, email, 1);
        return next === 1;
    },
    async removeConnection(email) {
        const next = await client.hincrby(KEY, email, -1);
        if (next <= 0) {
            await client.hdel(KEY, email);
            return next === 0; // true only on the 1 -> 0 transition
        }
        return false;
    },
    async onlineEmails() {
        const all = await client.hgetall(KEY);
        return Object.entries(all)
            .filter(([, v]) => Number(v) > 0)
            .map(([email]) => email);
    },
    async isOnline(email) {
        const v = await client.hget(KEY, email);
        return v !== null && Number(v) > 0;
    },
    async reset() {
        await client.del(KEY);
    },
});
