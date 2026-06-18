import { describe, expect, it, vi } from 'vitest';
import { makeSocketAuth } from './auth.js';

const fakeUser = { _id: 'u1', email: 'a@b.com' } as any;

function fakeSocket(token?: string) {
    return { handshake: { auth: token ? { token } : {} }, request: {} as any };
}

describe('makeSocketAuth', () => {
    it('attaches user to socket.request on a valid token', async () => {
        const getOrCreateUser = vi.fn().mockResolvedValue(fakeUser);
        const mw = makeSocketAuth({
            verify: vi.fn().mockResolvedValue({ email: 'a@b.com', emailVerified: true, sub: 's', picture: 'https://pic/x.png' }),
            getOrCreateUser,
        });
        const socket = fakeSocket('good');
        const next = vi.fn();
        await mw(socket as any, next);
        expect(socket.request.user).toBe(fakeUser);
        expect(next).toHaveBeenCalledWith();
        expect(getOrCreateUser).toHaveBeenCalledWith({ email: 'a@b.com', avatarUrl: 'https://pic/x.png' });
    });

    it('calls next with an error when the token is missing', async () => {
        const mw = makeSocketAuth({ verify: vi.fn(), getOrCreateUser: vi.fn() });
        const next = vi.fn();
        await mw(fakeSocket() as any, next);
        expect(next.mock.calls[0][0]?.message).toBe('unauthorized');
    });

    it('calls next with a generic unauthorized error when verify fails', async () => {
        const mw = makeSocketAuth({
            verify: vi.fn().mockRejectedValue(new Error('invalid token')),
            getOrCreateUser: vi.fn(),
        });
        const socket = fakeSocket('bad');
        const next = vi.fn();
        await mw(socket as any, next);
        expect(next.mock.calls[0][0]?.message).toBe('unauthorized');
    });
});
