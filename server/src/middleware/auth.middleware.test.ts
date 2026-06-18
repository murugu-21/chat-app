import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

// Prevent module-load env validation — the env-wired singletons are not under test here.
vi.mock('../lib/auth/index.js', () => ({ verifyToken: vi.fn() }));
vi.mock('../features/user/user.service.js', () => ({ getOrCreateUserByEmail: vi.fn() }));

import { makeRequireAuth } from './auth.middleware.js';

const fakeUser = { _id: 'u1', email: 'a@b.com' } as any;

function run(mw: any, headers: Record<string, string>) {
    const req = { headers } as unknown as Request;
    const res = {} as Response;
    return new Promise<{ req: Request; err: any }>((resolve) => {
        mw(req, res, (err: any) => resolve({ req, err }));
    });
}

describe('makeRequireAuth', () => {
    it('attaches the user for a valid bearer token', async () => {
        const verify = vi.fn().mockResolvedValue({ email: 'a@b.com', emailVerified: true, sub: 's' });
        const getOrCreateUser = vi.fn().mockResolvedValue(fakeUser);
        const mw = makeRequireAuth({
            verify,
            getOrCreateUser,
        });
        const { req, err } = await run(mw, { authorization: 'Bearer good' });
        expect(err).toBeUndefined();
        expect((req as any).user).toBe(fakeUser);
        expect(verify).toHaveBeenCalledWith('good');
        expect(getOrCreateUser).toHaveBeenCalledWith({ email: 'a@b.com' });
    });

    it('calls next with a 401 AppError when the header is missing', async () => {
        const mw = makeRequireAuth({
            verify: vi.fn(),
            getOrCreateUser: vi.fn(),
        });
        const { err } = await run(mw, {});
        expect(err.statusCode).toBe(401);
    });

    it('calls next with a 401 AppError when verification throws', async () => {
        const mw = makeRequireAuth({
            verify: vi.fn().mockRejectedValue(new Error('bad token')),
            getOrCreateUser: vi.fn(),
        });
        const { err } = await run(mw, { authorization: 'Bearer bad' });
        expect(err.statusCode).toBe(401);
    });
});
