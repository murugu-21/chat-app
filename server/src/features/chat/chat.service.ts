import { nanoid } from 'nanoid';

import * as chatDb from './chat.repository.js';
import * as userService from '../user/user.service.js';
import { UserT } from '../user/user.model.js';
import { Types } from 'mongoose';
import { ChatT } from './chat.model.js';
import { AppError } from '../../errorHandler/error.interface.js';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

const createChat = async ({
    fromUser,
    toUserEmail,
}: {
    fromUser: UserT;
    toUserEmail: string;
}): Promise<string> => {
    const toUser = await userService.getUserByEmail({ email: toUserEmail });
    const chat1 = await chatDb.createChat({
        userId: fromUser._id,
        chatId: nanoid(),
        chatName: toUser.email,
    });
    await chatDb.createChat({
        userId: toUser._id,
        chatId: chat1.chatId,
        chatName: fromUser.email,
    });
    return chat1.chatId;
};

const getChatForUser = async ({
    userId,
    chatId,
}: {
    userId: Types.ObjectId;
    chatId: string;
}): Promise<ChatT> => {
    const chat = await chatDb.getChatForUser({ userId, chatId });
    if (!chat) {
        throw new AppError({
            messageForSentry: `${chatId} chat not found for user ${userId.toString()}`,
            errorMessageForClient: ReasonPhrases.NOT_FOUND,
            statusCode: StatusCodes.NOT_FOUND,
        });
    }
    return chat;
};

export { createChat, getChatForUser };
