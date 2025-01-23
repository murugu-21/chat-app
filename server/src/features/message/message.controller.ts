import { Request, Response } from 'express';

import catchAsync from '../../utils/wrapAsync.js';
import * as messageService from './message.service.js';
import { StatusCodes } from 'http-status-codes';

const sendMessage = catchAsync(async (req: Request, res: Response) => {
    const { chat, user } = req;
    const { message } = req.body;
    const messageDoc = await messageService.sendMessage({
        user,
        chatId: chat.chatId,
        message,
    });
    res.status(StatusCodes.CREATED).json(messageDoc);
});

const listMessagesOfChat = catchAsync(async (req: Request, res: Response) => {
    const { chat } = req;
    const messageDoc = await messageService.listMessagesOfChat(chat.chatId);
    res.status(StatusCodes.CREATED).json(messageDoc);
});

export { sendMessage, listMessagesOfChat };
