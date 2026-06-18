import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import * as userDb from './user.repository.js';
import { UserT } from './user.model.js';

import { AppError } from '../../errorHandler/error.interface.js';

const getUserByEmail = async ({ email }: { email: string }): Promise<UserT> => {
    const user = await userDb.getUserByEmail({ email });
    if (!user) {
        throw new AppError({
            messageForSentry: 'email not found for getUser',
            errorMessageForClient: ReasonPhrases.NOT_FOUND,
            statusCode: StatusCodes.NOT_FOUND,
        });
    }
    return user;
};

const searchUsers = async (
    query: string,
): Promise<Array<Pick<UserT, '_id' | 'email'>>> => {
    const users = await userDb.searchUsers(query);
    return users;
};

const getOrCreateUserByEmail = async ({
    email,
    avatarUrl,
}: {
    email: string;
    avatarUrl?: string;
}): Promise<UserT> => {
    return userDb.getOrCreateUserByEmail({ email, avatarUrl });
};

const getUsersByEmails = async (emails: string[]) => userDb.getUsersByEmails(emails);

export { getUserByEmail, searchUsers, getOrCreateUserByEmail, getUsersByEmails };
