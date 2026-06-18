import http from 'http';
import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';

import env from './config/env.js';

import jsonMetaDataMW from './middleware/jsonMetaData.middleware.js';
import { requestLoggerMW } from './middleware/requestLogger.middleware.js';

import healthCheckRouter from './features/healthcheck/healthcheck.route.js';
import userRouter from './features/user/user.route.js';
import chatRouter from './features/chat/chat.route.js';
import messageRouter from './features/message/message.route.js';

import globalErrorHandler from './errorHandler/globalErrorHandler.js';
import zodErrorHandler from './errorHandler/zodErrorHandler.js';
import { corsList } from './constants.js';
import { io } from './features/socket/index.js';

const app: Express = express();

await mongoose.connect(env.DATABASE_URL, {
    dbName: 'chatApp',
});

app.use(
    cors({
        origin: corsList,
        methods: ['GET', 'POST'],
    }),
);

app.use(
    bodyParser.json({
        limit: '10mb',
    }),
);

app.use(requestLoggerMW);

app.use(jsonMetaDataMW);

app.use('/health', healthCheckRouter);

app.use('/user', userRouter);

app.use('/chat', chatRouter);

app.use('/message', messageRouter);

app.use(zodErrorHandler);

app.use(globalErrorHandler);

const server = http.createServer(app);
io.attach(server);

server.listen(env.PORT, () => {
    console.log(`server running on PORT: ${env.PORT}`);
});
