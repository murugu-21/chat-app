import { userModel, UserT } from './user.model.js';

const getUserByEmail = async ({
    email,
}: {
    email: string;
}): Promise<UserT | null> => {
    const user = await userModel.findOne({ email }).lean();
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

const getOrCreateUserByEmail = async ({
    email,
}: {
    email: string;
}): Promise<UserT> => {
    const user = await userModel.findOneAndUpdate(
        { email },
        { $setOnInsert: { email } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return user as UserT;
};

export { getUserByEmail, searchUsers, getOrCreateUserByEmail };
