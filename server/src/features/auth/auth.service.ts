import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { AppError } from '../../errorHandler/error.interface.js';
import * as otpDb from './otp.repository.js';
import * as userService from '../user/user.service.js';
import { signToken } from '../../lib/jsonwebtoken/index.js';

const changePassword = async ({
    otp,
    newPassword,
}: {
    otp: string;
    newPassword: string;
}) => {
    const otpData = await otpDb.getOtpByOtpId(otp);
    if (!otpData) {
        throw new AppError({
            messageForSentry: 'invalid otp',
            errorMessageForClient: ReasonPhrases.NOT_FOUND,
            statusCode: StatusCodes.NOT_FOUND,
        });
    }
    const user = await userService.changePassword({
        userId: otpData.userId,
        newPassword: newPassword,
    });
    await otpDb.deleteOtpByOtpId(otp);
    return user;
};

const login = (userId: string): string => {
    return signToken({ userId });
};

export { changePassword, login };
