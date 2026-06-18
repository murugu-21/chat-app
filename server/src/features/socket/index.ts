import { Server } from 'socket.io';

import { corsList } from '../../constants.js';
import { stampActivity } from '../../lib/activity/index.js';
import * as chatService from '../chat/chat.service.js';
import { makeSocketAuth } from './auth.js';
import { verifyToken } from '../../lib/auth/index.js';
import * as userService from '../user/user.service.js';

const io = new Server({
    cors: { origin: corsList, methods: ['GET', 'POST'] },
});

io.use(
    makeSocketAuth({
        verify: verifyToken,
        getOrCreateUser: userService.getOrCreateUserByEmail,
    }),
);

io.on('connection', (socket) => {
    stampActivity();
    const userId = (socket.request as any).user?.email;
    console.log(`${userId} user connected`);

    socket.on('disconnect', () => console.log(`${userId} user disconnected`));

    socket.on('join', async (chatId, callback) => {
        try {
            const chat = await chatService.getChatForUser({
                userId: (socket.request as any).user._id,
                chatId,
            });
            await socket.join(`message:${chat.chatId}`);
        } catch (e) {
            callback({ status: 'NOK' });
        }
    });

    socket.on('leave', async (chatId, callback) => {
        try {
            const chat = await chatService.getChatForUser({
                userId: (socket.request as any).user._id,
                chatId,
            });
            await socket.leave(`message:${chat.chatId}`);
        } catch (e) {
            callback({ status: 'NOK' });
        }
    });
});

export { io };
