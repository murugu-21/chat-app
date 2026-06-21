import { describe, expect, it } from 'vitest';
import RedisMock from 'ioredis-mock';
import type { Redis } from 'ioredis';

import { makeSocketRedisAdapter } from './index.js';

describe('makeSocketRedisAdapter', () => {
    it('returns a socket.io adapter factory (a constructor function)', () => {
        const client = new RedisMock() as unknown as Redis;
        const adapter = makeSocketRedisAdapter(client);
        expect(typeof adapter).toBe('function');
    });
});
