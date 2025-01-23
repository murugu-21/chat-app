import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppError } from '../../errorHandler/error.interface.js';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
const saltRounds = 10;

const generatePassword = (): string => randomUUID();

const hashPassword = async (password: string): Promise<string> => {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
};

const checkPassword = async ({
    password,
    hash,
}: {
    password: string;
    hash: string;
}): Promise<void> => {
    const result = await bcrypt.compare(password, hash);
    if (!result) {
        throw new AppError({
            messageForSentry: 'Password incorrect',
            errorMessageForClient: ReasonPhrases.NOT_FOUND,
            statusCode: StatusCodes.NOT_FOUND,
        });
    }
};

export { generatePassword, hashPassword, checkPassword };
