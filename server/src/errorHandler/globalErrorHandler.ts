import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { AppError } from './error.interface.js';
import { captureException } from '@sentry/node';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import env from '../config/env.js';

const globalErrorHandler: ErrorRequestHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    if (env.NODE_ENV !== 'local' && env.NODE_ENV !== 'test') {
        captureException(err);
    }
    if (err instanceof AppError) {
        if (env.NODE_ENV === 'local') {
            console.log('app error', err.message);
        }
        res.status(err.statusCode).json({
            message: err.errorMessageForClient,
        });
        return;
    }
    if (env.NODE_ENV === 'local') {
        console.log('unhandled error', err.message);
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: ReasonPhrases.INTERNAL_SERVER_ERROR,
    });
    return;
};

export default globalErrorHandler;
