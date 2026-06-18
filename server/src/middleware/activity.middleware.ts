import { Request, Response, NextFunction, RequestHandler } from 'express';
import { stampActivity } from '../lib/activity/index.js';

// Stamp real (non-health) requests so the on-box idle-check sees the box in use.
export const activityMW: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/health')) stampActivity();
    next();
};
