import { Request, Response, NextFunction, RequestHandler } from 'express';

const catchAsync =
  (requestHandler: RequestHandler): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction) =>
    (requestHandler(req, res, next) as Promise<void>).catch((error: any) => {
      next(error);
    });

export default catchAsync;
