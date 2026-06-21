import { describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';

import { selectPresence } from './index.js';

describe('presence selection', () => {
    it('uses in-memory presence when there is no Redis client', async () => {
        const presence = selectPresence(null);
        expect(await presence.addConnection('a@x.com')).toBe(true);
        expect(await presence.onlineEmails()).toEqual(['a@x.com']);
    });

    it('uses Redis presence (writes to the provided client) when a client is given', async () => {
        const client = new RedisMock() as unknown as Redis;
        const presence = selectPresence(client);
        await presence.addConnection('b@x.com');
        // Proves the Redis impl is selected: the count lands in the given client.
        expect(await (client as unknown as { hget: (k: string, f: string) => Promise<string | null> }).hget('presence:counts', 'b@x.com')).toBe('1');
        expect(await presence.onlineEmails()).toEqual(['b@x.com']);
    });
});
