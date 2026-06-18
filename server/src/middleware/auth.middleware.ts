import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { AppError } from '../errorHandler/error.interface.js';
import type { Verifier } from '../lib/auth/cognito.verifier.js';
import { verifyToken } from '../lib/auth/index.js';
import type { UserT } from '../features/user/user.model.js';
import * as userService from '../features/user/user.service.js';

type Deps = {
    verify: Verifier;
    getOrCreateUser: (args: { email: string; avatarUrl?: string }) => Promise<UserT>;
};

const unauthorized = (messageForSentry: string) =>
    new AppError({
        messageForSentry,
        errorMessageForClient: ReasonPhrases.UNAUTHORIZED,
        statusCode: StatusCodes.UNAUTHORIZED,
    });

export const makeRequireAuth =
    ({ verify, getOrCreateUser }: Deps): RequestHandler =>
    async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const header = req.headers.authorization ?? '';
            const [scheme, token] = header.split(' ');
            if (scheme !== 'Bearer' || !token) {
                return next(unauthorized('missing bearer token'));
            }
            const identity = await verify(token);
            req.user = await getOrCreateUser({ email: identity.email, avatarUrl: identity.picture });
            return next();
        } catch (e) {
            return next(unauthorized(e instanceof Error ? e.message : 'auth failed'));
        }
    };

export const requireAuth: RequestHandler = makeRequireAuth({
    verify: verifyToken,
    getOrCreateUser: userService.getOrCreateUserByEmail,
});
