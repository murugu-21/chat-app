import { io } from '../socket/index.js';
import { UserT } from '../user/user.model.js';
import { MessageT } from './message.model.js';
import * as messageDb from './message.repository.js';

const sendMessage = async ({
    user,
    chatId,
    content,
}: {
    user: UserT;
    chatId: string;
    content: string;
}): Promise<MessageT> => {
    const messageDoc = await messageDb.addMessage({
        chatId,
        content,
        createdBy: user._id,
    });
    io.to(`message:${chatId}`).emit('message', JSON.stringify({
        _id: messageDoc._id,
        chatId,
        content,
        createdBy: {
            _id: user._id,
            email: user.email,
        }
    }))
    return messageDoc;
};

const listMessagesOfChat = async (chatId: string) => {
    const messages = await messageDb.listMessagesOfChat(chatId);
    return messages;
};

export { sendMessage, listMessagesOfChat };
