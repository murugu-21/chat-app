import { RequestHandler, Request, Response } from 'express';

import catchAsync from '../../utils/wrapAsync.js';
import * as chatService from './chat.service.js';
import { StatusCodes } from 'http-status-codes';

const createChat: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
        const { user } = req;
        const { email } = req.body;
        const chatId = await chatService.createChat({
            fromUser: user,
            toUserEmail: email,
        });
        res.status(StatusCodes.CREATED).json(chatId);
    },
);

export { createChat };
