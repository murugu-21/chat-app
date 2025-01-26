import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import passport from 'passport';
import mongoose from 'mongoose';

import env from './config/env.js';

import jsonMetaDataMW from './middleware/jsonMetaData.middleware.js';
import { requestLoggerMW } from './middleware/requestLogger.middleware.js';

import healthCheckRouter from './features/healthcheck/healthcheck.route.js';
import userRouter from './features/user/user.route.js';
import authRouter from './features/auth/auth.route.js';
import chatRouter from './features/chat/chat.route.js';
import messageRouter from './features/message/message.route.js';

import globalErrorHandler from './errorHandler/globalErrorHandler.js';
import zodErrorHandler from './errorHandler/zodErrorHandler.js';
import { corsList } from './constants.js';

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

app.use(passport.initialize());

app.use(requestLoggerMW);

app.use(jsonMetaDataMW);

app.use('/health', healthCheckRouter);

app.use('/user', userRouter);

app.use('/auth', authRouter);

app.use('/chat', chatRouter);

app.use('/message', messageRouter);

app.use(zodErrorHandler);

app.use(globalErrorHandler);

app.listen(env.PORT, () => {
    console.log(`server running on PORT: ${env.PORT}`);
});
