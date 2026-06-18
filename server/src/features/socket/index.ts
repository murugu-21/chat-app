import { Server } from 'socket.io';

import { corsList } from '../../constants.js';
import * as chatService from '../chat/chat.service.js';
import { makeSocketAuth } from './auth.js';
import { verifyToken } from '../../lib/auth/index.js';
import * as userService from '../user/user.service.js';
import { addConnection, removeConnection, onlineEmails } from '../presence/presence.js';

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
    const email = (socket.request as any).user?.email as string | undefined;
    if (email) {
        const wentOnline = addConnection(email);
        socket.emit('presence:state', onlineEmails());
        if (wentOnline) socket.broadcast.emit('presence:update', { email, online: true });
    }

    socket.on('disconnect', () => {
        if (email && removeConnection(email)) {
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
