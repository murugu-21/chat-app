import { AsyncLocalStorage } from 'async_hooks';
import { logger } from 'express-winston';
import { createLogger, transports, format } from 'winston';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import os from 'os';

const MESSAGE = Symbol.for('message');

const LOG_LEVEL_SEVERITY = {
    fatal: 1,
    error: 2,
    warn: 3,
    trace: 4,
    info: 5,
    debug: 6,
};

export enum LOG_LEVELS {
    FATAL = 'fatal',
    ERROR = 'error',
    WARN = 'warn',
    TRACE = 'trace',
    INFO = 'info',
    DEBUG = 'debug',
}

const logFormat = format((info: any) => {
    const infoCopy = { ...info };
    infoCopy[MESSAGE] =
        `${new Date().toISOString()} ${info.level.toUpperCase()} [${info.message.instanceId}] ` +
        `[${info.message.product}] [${info.message.processName}] [${info.message.fileName}] ` +
        `[${info.message.methodName}] [${info.message.requestId}] ${info.message.message}`;
    return infoCopy;
})();

const fileTransport = new transports.File({
    filename: `/var/log/chat-app/node/node.log`,
    level: LOG_LEVELS.INFO,
});

const appLogger = createLogger({
    format: logFormat,
    levels: LOG_LEVEL_SEVERITY,
}).add(fileTransport);

const writeLog = (
    loglevel: LOG_LEVELS,
    message: string,
    requestId?: string,
) => {
    const logMsg = {
        instanceId: os.hostname,
        product: 'chat-app',
        processName: 'node',
        requestId: requestId || asyncLocalStorage.getStore()?.get('requestId'),
        message,
        level: loglevel,
        fileName: 'unknown',
        methodName: 'unknown',
    };
    appLogger.log({ level: loglevel, message: logMsg as unknown as string });
};

const wRequestLogger = createLogger({
    transports: [
        new transports.File({
            filename: '/var/log/chat-app/request.log',
        }),
    ],
    format: format.combine(format.timestamp(), format.json()),
});

const logRequestToFileMW = logger({
    winstonInstance: wRequestLogger,
    meta: true,
    expressFormat: true,
    colorize: false,
    requestFilter: (req: Request, propName: string) =>
        req[propName as keyof Request],
    responseFilter: (res: Response, propName: string) =>
        res[propName as keyof Response],
    dynamicMeta(req) {
        return {
            product: 'chat-app',
            ip: (req: Request) =>
                req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            route: (req.route || {}).path,
        };
    },
    ignoreRoute: (_req: Request) => false,
    skip: (_req: Request) => false,
});

const asyncLocalStorage = new AsyncLocalStorage<Map<string, string>>();

const requestLoggerMW = (req: Request, res: Response, next: NextFunction) => {
    const xRequestId = req.headers['x-request-id'];
    req.id =
        (xRequestId as string | undefined) || `${Date.now()}-${randomUUID()}`;
    res.setHeader('X-Request-Id', req.id);
    // store in asyncLocalStorage for app logs and call next within the context
    asyncLocalStorage.run(new Map(), () => {
        asyncLocalStorage.getStore()?.set('requestId', req.id);
        logRequestToFileMW(req, res, next);
    });
};

export { requestLoggerMW, writeLog };
