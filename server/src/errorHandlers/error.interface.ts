export class AppError extends Error {
  statusCode: number;
  errorMessageForClient: string;

  constructor(
    message: string,
    errorMessageForClient: string,
    statusCode: number
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorMessageForClient = errorMessageForClient;
    Error.captureStackTrace(this, this.constructor);
  }
}
