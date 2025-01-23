import { InferSchemaType, model, Schema, Types } from 'mongoose';
import { userCollectionName } from '../user/user.model.js';

const messageCollectionName = 'messages';

const messageSchema = new Schema(
    {
        chatId: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: userCollectionName,
        },
    },
    {
        timestamps: true,
        collection: messageCollectionName,
    },
);

const messageModel = model(messageCollectionName, messageSchema);

type MessageDataT = Omit<
    InferSchemaType<typeof messageSchema>,
    'createdAt' | 'updatedAt'
>;

type MessageT = MessageDataT & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

export { messageCollectionName, messageModel, MessageDataT, MessageT };
