import { Types } from 'mongoose';
import { UserDataT, userModel, UserT } from './user.model.js';

const createUser = async (userData: UserDataT): Promise<UserT> => {
    const user = await userModel.create(userData);
    return user;
};

const changePassword = async ({
    userId,
    newPassword,
}: {
    userId: Types.ObjectId;
    newPassword: string;
}): Promise<UserT | null> => {
    const user = await userModel.findOneAndUpdate(
        { _id: userId },
        { password: newPassword },
        { new: true },
    );
    return user;
};

const getUserByEmail = async ({
    email,
}: {
    email: string;
}): Promise<UserT | null> => {
    const user = await userModel.findOne({ email }).lean();
    return user;
};

const getUserById = async ({
    userId,
}: {
    userId: string;
}): Promise<UserT | null> => {
    const user = await userModel.findOne({ _id: userId }).lean();
    return user;
};

const searchUsers = async (
    query: string,
): Promise<Array<Pick<UserT, '_id' | 'email'>>> => {
    const users = await userModel
        .find({ email: { $regex: '^' + query } }, { _id: 1, email: 1 })
        .lean();
    return users;
};

export { createUser, changePassword, getUserByEmail, getUserById, searchUsers };
