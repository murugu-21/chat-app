import { Response, NextFunction } from "express";
import { createServer } from 'http';
import { Server } from 'socket.io';

import { authJwtMW } from "../../lib/passport/index.js";
import env from "../../config/env.js";
import { corsList } from '../../constants.js';
import * as chatService from '../chat/chat.service.js';

const server = createServer();
const io = new Server(server, {
    cors: { origin: corsList, methods: ['GET', 'POST'] },
});

io.engine.use((req: any, res: Response, next: NextFunction) => {
    const isHandshake = req._query.sid === undefined;
    if (isHandshake) {
        authJwtMW(req, res, next);
    } else {
        next();
    }
});

io.on('connection', (socket) => {
    const userId = (socket.request as any).user?.email;
    console.log(`${userId} user connected`);

    socket.on('disconnect', () => console.log(`${userId} user disconnected`));

    socket.on('join', async (chatId, callback) => {
        try {
            const chat = await chatService.getChatForUser({ userId: (socket.request as any).user._id, chatId });
            await socket.join(`message:${chat.chatId}`);
        } catch (e) {
            callback({
                status: 'NOK',
            });
        }
    })

    socket.on('leave', async (chatId, callback) => {
        try {
            const chat = await chatService.getChatForUser({
                userId: (socket.request as any).user._id,
                chatId,
            });
            await socket.leave(`message:${chat.chatId}`);
        } catch (e) {
            callback({
                status: 'NOK',
            });
        }
    })
});

server.listen(env.WEBSOCKET_PORT, () => {
    console.log(`websocket server running on PORT: ${env.WEBSOCKET_PORT}`);
});

export { io }
