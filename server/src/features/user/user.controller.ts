import { RequestHandler, Request, Response } from 'express';
import catchAsync from '../../utils/wrapAsync.js';
import * as userService from './user.service.js';
import { StatusCodes } from 'http-status-codes';

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

export { getUser, searchUsers };
