import { InferSchemaType, model, Schema, Types } from 'mongoose';

const userCollectionName = 'users';

const userSchema = new Schema(
    {
        email: {
            type: String,
            unique: true,
            required: true,
        },
        avatarUrl: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
        collection: userCollectionName,
    },
);

const userModel = model(userCollectionName, userSchema);

type UserDataT = Omit<
    InferSchemaType<typeof userSchema>,
    'createdAt' | 'updatedAt'
>;

type UserT = UserDataT & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

export { userCollectionName, userModel, UserDataT, UserT };
