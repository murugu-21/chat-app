import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { requireAuth } from '../../middleware/auth.middleware.js';

// A tiny app that mounts only the middleware under test.
const app = express();
app.get('/protected', requireAuth, (req, res) => {
    res.json({ email: (req as any).user.email });
});
app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode ?? 500).json({ error: err.errorMessageForClient });
});

let mongod: MongoMemoryServer;
beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: 'test' });
});
afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

describe('requireAuth on a protected route (dev mode)', () => {
    it('401 without a token', async () => {
        await request(app).get('/protected').expect(401);
    });

    it('200 and JIT user with a dev token', async () => {
        const res = await request(app)
            .get('/protected')
            .set('Authorization', 'Bearer dev_smoke@example.com')
            .expect(200);
        expect(res.body.email).toBe('smoke@example.com');
    });
});
