import { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { AppError } from "./error.interface.js";
import { GENERIC_ERROR_MESSAGE } from "./constants.js";
import { captureException } from "@sentry/node";

const globalErrorHandler: ErrorRequestHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  captureException(err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      message: err.errorMessageForClient,
    });
    return;
  }
  res.status(500).json({
    message: GENERIC_ERROR_MESSAGE,
  });
  return; 
};

export default globalErrorHandler;
