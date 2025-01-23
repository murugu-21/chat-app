import { InferSchemaType, model, Schema, Types } from 'mongoose';
import { userCollectionName } from '../user/user.model.js';

const otpCollectionName = 'otps';

const otpSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: userCollectionName,
            required: true,
        },
        otp: {
            type: String,
            required: true,
        },
        attemptNo: {
            type: Number,
            required: true,
        },
        expiresIn: {
            type: Date,
            required: true,
        },
    },
    {
        timestamps: true,
        collection: otpCollectionName,
    },
);

const otpModel = model(otpCollectionName, otpSchema);

type OtpDataT = Omit<
    InferSchemaType<typeof otpSchema>,
    'createdAt' | 'updatedAt'
>;

type OtpT = OtpDataT & {
    _id: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

export { otpCollectionName, otpModel, OtpDataT, OtpT };
