import express, { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

const corsList = [
    env.NODE_ENV === 'prod'
        ? /^https:\/\/[a-zA-Z0-9-]*\.d2v9syk4m83jg4.amplifyapp.com$/
        : /^http[s]?:\/\/localhost:\d{4}$/,
];

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

const server = createServer(app);
const io = new Server(server, {
    cors: { origin: corsList, methods: ['GET', 'POST'] },
});

server.listen(env.WEBSOCKET_PORT, () => {
    console.log(`websocket server running on PORT: ${env.WEBSOCKET_PORT}`);
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => console.log('user disconnected'));
});

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
