import { UserT } from '../user/user.model.js';
import { MessageDataT, messageModel, MessageT } from './message.model.js';

const addMessage = async (data: MessageDataT): Promise<MessageT> => {
    const message = await messageModel.create(data);
    return message;
};

const listMessagesOfChat = async (chatId: string) => {
    const messages = await messageModel
        .find({ chatId })
        .populate<{ userId: Pick<UserT, 'email'> }>('userId', 'email');
    return messages;
};

export { addMessage, listMessagesOfChat };
