import { Request, Response, NextFunction, RequestHandler } from 'express';
import catchAsync from '../../utils/wrapAsync.js';
import * as chatService from '../chat/chat.service.js';

const loadChatForUser: RequestHandler = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
        const { user } = req;
        const chatId = req.params.chatId || req.body.chatId;
        const chat = await chatService.getChatForUser({
            userId: user._id,
            chatId,
        });
        req.chat = chat;
        next();
    },
);

export { loadChatForUser };
