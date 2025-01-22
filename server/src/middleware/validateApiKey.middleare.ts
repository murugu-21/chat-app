import { Request, Response, NextFunction, RequestHandler } from 'express';

import env from '../config/env.js';

type ApiKeyT = 'ADMIN_API_KEY';

const validateAPiKeyMW =
  (apiKeyType: ApiKeyT): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey || apiKey !== env[apiKeyType]) {
      res.status(403).json({
        message: 'apiKey invalid',
      });
      return;
    }
    next();
  };

export { validateAPiKeyMW, ApiKeyT };
