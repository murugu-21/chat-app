import { Server } from 'socket.io';

import { corsList } from '../../constants.js';
import { stampActivity } from '../../lib/activity/index.js';
import * as chatService from '../chat/chat.service.js';
import { makeSocketAuth } from './auth.js';
import { verifyToken } from '../../lib/auth/index.js';
import * as userService from '../user/user.service.js';
import { presence } from '../presence/index.js';

const io = new Server({
    cors: { origin: corsList, methods: ['GET', 'POST'] },
});

io.use(
    makeSocketAuth({
        verify: verifyToken,
        getOrCreateUser: userService.getOrCreateUserByEmail,
    }),
);

io.on('connection', async (socket) => {
    stampActivity();
    const email = (socket.request as any).user?.email as string | undefined;
    if (email) {
        const wentOnline = await presence.addConnection(email);
        socket.emit('presence:state', await presence.onlineEmails());
        if (wentOnline) socket.broadcast.emit('presence:update', { email, online: true });
    }

    socket.on('disconnect', async () => {
        if (email && (await presence.removeConnection(email))) {
            io.emit('presence:update', { email, online: false });
        }
    });

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
