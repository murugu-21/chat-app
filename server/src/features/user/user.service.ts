import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import * as userDb from './user.repository.js';
import * as otpDb from '../auth/otp.repository.js';
import env from '../../config/env.js';
import { UserT } from './user.model.js';
import { generatePassword, hashPassword } from '../../lib/bcrypt/index.js';
import { sendMail } from '../../lib/ses/index.js';

import { AppError } from '../../errorHandler/error.interface.js';
import { getDateAfterNDays } from '../../lib/date-fns/index.js';

const createUser = async ({ email }: { email: string }): Promise<UserT> => {
    const password = generatePassword();
    const hashedPassword = await hashPassword(password);
    const user = await userDb.createUser({ email, password: hashedPassword });
    const otp = await otpDb.createOtp({
        userId: user._id,
        otp: generatePassword(),
        attemptNo: 1,
        expiresIn: getDateAfterNDays(1),
    });
    const passwordResetUrl = `${env.CLIENT_URL}/resetPassword/${otp.otp}`;
    await sendMail({
        from: env.NOTIFICATIONS_EMAIL,
        to: user.email,
        subject: 'Welcome to chat app, Please set your password',
        html: `<p>use below link to set your password <a href="${passwordResetUrl}">${passwordResetUrl}</a></p>`,
    });
    return user;
};

const changePassword = async ({
    userId,
    newPassword,
}: {
    userId: Types.ObjectId;
    newPassword: string;
}): Promise<UserT> => {
    const hashedPassword = await hashPassword(newPassword);
    const user = await userDb.changePassword({
        userId,
        newPassword: hashedPassword,
    });
    if (!user) {
        throw new AppError({
            messageForSentry: 'userId not found for change password',
            errorMessageForClient: ReasonPhrases.NOT_FOUND,
            statusCode: StatusCodes.NOT_FOUND,
        });
    }
    return user;
};

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

const getUserById = async ({ userId }: { userId: string }): Promise<UserT> => {
    const user = await userDb.getUserById({ userId });
    if (!user) {
        throw new AppError({
            messageForSentry: 'User not found from userId',
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

export { createUser, changePassword, getUserByEmail, getUserById, searchUsers };
