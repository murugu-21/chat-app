import express, { Express, NextFunction, Request, Response } from "express";
import env from './config/env.js';

import jsonMetaDataMW from './middleware/jsonMetaData.middleware.js';
import { requestLoggerMW } from './middleware/requestLogger.middleware.js';

import healthCheckRouter from './features/healthcheck/route.js';

import globalErrorHandler from './errorHandlers/globalErrorHandler.js';

const app: Express = express();

app.use(requestLoggerMW);

app.use(jsonMetaDataMW);

app.use('/health', healthCheckRouter);

app.use(globalErrorHandler);

app.listen(env.PORT, () => {
  console.log(`server running on PORT: ${env.PORT}`);
});
