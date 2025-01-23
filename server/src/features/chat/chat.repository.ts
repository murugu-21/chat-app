import { Types } from 'mongoose';
import { chatModel, ChatDataT, ChatT } from './chat.model.js';

const createChat = async (data: ChatDataT): Promise<ChatT> => {
    const chat = await chatModel.create(data);
    return chat;
};

const listChatsOfUser = async (userId: string): Promise<Array<ChatT>> => {
    const chats = await chatModel.find({ userId });
    return chats;
};

const getChatForUser = async ({
    userId,
    chatId,
}: {
    userId: Types.ObjectId;
    chatId: string;
}): Promise<ChatT | null> => {
    const chat = await chatModel.findOne({ userId, chatId }).lean();
    return chat;
};

export { createChat, listChatsOfUser, getChatForUser };
