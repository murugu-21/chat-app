import { UserT } from '../user/user.model.js';
import { MessageT } from './message.model.js';
import * as messageDb from './message.repository.js';

const sendMessage = async ({
    user,
    chatId,
    message,
}: {
    user: UserT;
    chatId: string;
    message: string;
}): Promise<MessageT> => {
    const messageDoc = await messageDb.addMessage({
        chatId,
        content: message,
        createdBy: user._id,
    });
    return messageDoc;
};

const listMessagesOfChat = async (chatId: string) => {
    const messages = await messageDb.listMessagesOfChat(chatId);
    return messages;
};

export { sendMessage, listMessagesOfChat };
