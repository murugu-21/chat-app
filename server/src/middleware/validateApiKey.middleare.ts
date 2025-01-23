import { Request, Response, NextFunction, RequestHandler } from 'express';

import env from '../config/env.js';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

type ApiKeyT = 'ADMIN_API_KEY';

const validateAPiKeyMW =
    (apiKeyType: ApiKeyT): RequestHandler =>
    (req: Request, res: Response, next: NextFunction): void => {
        const apiKey = req.headers['x-api-key'] as string;
        if (!apiKey || apiKey !== env[apiKeyType]) {
            res.status(StatusCodes.FORBIDDEN).json({
                message: ReasonPhrases.FORBIDDEN,
            });
            return;
        }
        next();
    };

export { validateAPiKeyMW, ApiKeyT };
