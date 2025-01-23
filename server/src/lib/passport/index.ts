import { Request, Response, NextFunction, RequestHandler } from 'express';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import {
    ExtractJwt,
    Strategy,
    StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import * as userService from '../../features/user/user.service.js';
import { checkPassword } from '../bcrypt/index.js';
import env from '../../config/env.js';
import { AppError } from '../../errorHandler/error.interface.js';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

passport.use(
    new LocalStrategy.Strategy(
        {
            usernameField: 'email',
            passwordField: 'password',
        },
        async function (email, password, done) {
            try {
                const user = await userService.getUserByEmail({ email });
                await checkPassword({ password, hash: user.password });
                done(null, user);
            } catch (e) {
                return done(
                    new AppError({
                        messageForSentry: 'jwt AuthFailure',
                        errorMessageForClient: ReasonPhrases.UNAUTHORIZED,
                        statusCode: StatusCodes.UNAUTHORIZED,
                    }),
                    false,
                );
            }
        },
    ),
);

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user as any);
});

const jwtOpts: StrategyOptionsWithoutRequest = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: env.JWT_SECRET,
};

const jwtStrategy = new Strategy(jwtOpts, async (payload, done) => {
    try {
        const user = await userService.getUserById({ userId: payload.userId });
        done(null, user);
    } catch (e) {
        return done(
            new AppError({
                messageForSentry: 'jwt AuthFailure',
                errorMessageForClient: ReasonPhrases.UNAUTHORIZED,
                statusCode: StatusCodes.UNAUTHORIZED,
            }),
            false,
        );
    }
});

passport.use(jwtStrategy);

const userNamePasswordMW = passport.authenticate('local', { session: false });

const authJwtMW: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    passport.authenticate(
        'jwt',
        { session: false },
        (
            err: unknown,
            user: Express.User,
            info: object | string | Array<string | undefined>,
        ) => {
            // If authentication failed, `user` will be set to false. If an exception occurred, `err` will be set.
            if (err || !user) {
                // PASS THE ERROR OBJECT TO THE NEXT ROUTE i.e THE APP'S COMMON ERROR HANDLING MIDDLEWARE
                return next(
                    new AppError({
                        messageForSentry:
                            typeof info === 'object'
                                ? JSON.stringify(info)
                                : info,
                        errorMessageForClient: ReasonPhrases.UNAUTHORIZED,
                        statusCode: StatusCodes.UNAUTHORIZED,
                    }),
                );
            } else {
                return next();
            }
        },
    )(req, res, next);
};

export { userNamePasswordMW, authJwtMW };
