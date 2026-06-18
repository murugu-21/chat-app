import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getOrCreateUserByEmail } from './user.repository.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'test' });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

describe('getOrCreateUserByEmail', () => {
    it('stores avatarUrl on insert and refreshes it on update', async () => {
        const a = await getOrCreateUserByEmail({ email: 'av@example.com', avatarUrl: 'https://pic/1.png' });
        expect(a.avatarUrl).toBe('https://pic/1.png');
        const b = await getOrCreateUserByEmail({ email: 'av@example.com', avatarUrl: 'https://pic/2.png' });
        expect(b._id.toString()).toBe(a._id.toString());
        expect(b.avatarUrl).toBe('https://pic/2.png'); // refreshed
        const c = await getOrCreateUserByEmail({ email: 'av@example.com' }); // no picture (dev token)
        expect(c.avatarUrl).toBe('https://pic/2.png'); // not cleared
    });

    it('creates a user on first call and is idempotent', async () => {
        const first = await getOrCreateUserByEmail({ email: 'jit@example.com' });
        expect(first.email).toBe('jit@example.com');

        const second = await getOrCreateUserByEmail({ email: 'jit@example.com' });
        expect(second._id.toString()).toBe(first._id.toString());

        const count = await mongoose.connection
            .collection('users')
            .countDocuments({ email: 'jit@example.com' });
        expect(count).toBe(1);
    });
});
