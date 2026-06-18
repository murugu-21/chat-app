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
