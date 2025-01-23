import { RequestHandler, Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

const healthCheck: RequestHandler = (_req: Request, res: Response): void => {
    res.status(StatusCodes.OK).json({ message: ReasonPhrases.OK });
};

export { healthCheck };
