import { RequestHandler, Request, Response } from 'express';
import catchAsync from '../../utils/wrapAsync.js';
import * as userService from './user.service.js';
import { StatusCodes } from 'http-status-codes';

const createUser: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
        const { email } = req.body;
        const user = await userService.createUser({ email });
        res.status(StatusCodes.CREATED).json(user);
    },
);

const getUser: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
        const { user } = req;
        res.status(StatusCodes.OK).json(user);
    },
);

const searchUsers: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
        const { query } = req.body;
        const users = await userService.searchUsers(query);
        res.status(StatusCodes.OK).json(users);
    },
);

export { createUser, getUser, searchUsers };
