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
    // Case-insensitive substring match; escape regex metacharacters so a
    // literal '.' in an email matches a '.' (not "any char") and the query
    // can't inject a pattern.
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await userModel
        .find({ email: { $regex: escaped, $options: 'i' } }, { _id: 1, email: 1 })
        .lean();
    return users;
};

const getOrCreateUserByEmail = async ({
    email,
    avatarUrl,
}: {
    email: string;
    avatarUrl?: string;
}): Promise<UserT> => {
    const user = await userModel.findOneAndUpdate(
        { email },
        {
            ...(avatarUrl ? { $set: { avatarUrl } } : {}),
            $setOnInsert: { email },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return user as UserT;
};

const getUsersByEmails = async (
    emails: string[],
): Promise<Array<Pick<UserT, 'email' | 'avatarUrl'>>> => {
    if (emails.length === 0) return [];
    const users = await userModel
        .find({ email: { $in: emails } }, { _id: 0, email: 1, avatarUrl: 1 })
        .lean();
    return users as Array<Pick<UserT, 'email' | 'avatarUrl'>>;
};

export { getUserByEmail, searchUsers, getOrCreateUserByEmail, getUsersByEmails };
