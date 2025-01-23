import { model, Schema, InferSchemaType, Types } from 'mongoose';

const chatCollectionName = 'chats';

const chatSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
        },
        chatId: {
            type: String,
            required: true,
        },
        chatName: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
        collection: chatCollectionName,
    },
);

const chatModel = model(chatCollectionName, chatSchema);

type ChatDataT = Omit<
    InferSchemaType<typeof chatSchema>,
    'createdAt' | 'updatedAt'
>;

type ChatT = ChatDataT & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

export { chatCollectionName, chatModel, ChatDataT, ChatT };
