import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
    statusCode: StatusCodes;
    errorMessageForClient: string;

    constructor({
        messageForSentry,
        errorMessageForClient,
        statusCode,
    }: {
        messageForSentry: string;
        errorMessageForClient: string;
        statusCode: number;
    }) {
        super(messageForSentry);
        this.statusCode = statusCode;
        this.errorMessageForClient = errorMessageForClient;
        Error.captureStackTrace(this, this.constructor);
    }
}
