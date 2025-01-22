import { RequestHandler, Request, Response } from 'express';

const healthCheck: RequestHandler = (_req: Request, res: Response): void => {
  res.status(200).json({
    response: {
      message: "Service is running"
    }
  })
}

export { healthCheck }
