import type { Verifier } from '../../lib/auth/cognito.verifier.js';
import type { UserT } from '../user/user.model.js';

type Deps = {
    verify: Verifier;
    getOrCreateUser: (args: { email: string }) => Promise<UserT>;
};

export const makeSocketAuth =
    ({ verify, getOrCreateUser }: Deps) =>
    async (socket: any, next: (err?: Error) => void): Promise<void> => {
        try {
            const token: string | undefined = socket.handshake?.auth?.token;
            if (!token) throw new Error('missing token');
            const identity = await verify(token);
            socket.request.user = await getOrCreateUser({ email: identity.email });
            next();
        } catch {
            next(new Error('unauthorized'));
        }
    };
