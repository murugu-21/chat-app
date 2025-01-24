import { RequestHandler, Request, Response } from 'express';
import catchAsync from '../../utils/wrapAsync.js';
import * as authService from './auth.service.js';
import { StatusCodes } from 'http-status-codes';

const changePassword: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
        const { otp, newPassword } = req.body;
        const user = await authService.changePassword({ otp, newPassword });
        res.status(StatusCodes.CREATED).json(user);
    },
);

const login: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
        const { user } = req;
        const token = authService.login(user!!._id.toString());
        res.status(StatusCodes.CREATED).json({ token });
    },
);

export { changePassword, login };
