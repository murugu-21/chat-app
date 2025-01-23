import { Router } from 'express';
import { validatorMW } from '../../middleware/validator.middleware.js';
import { createUserValidator, searchUsersValidator } from './user.validator.js';
import * as userController from './user.controller.js';
import { authJwtMW } from '../../lib/passport/index.js';

const createUserValidatorMW = validatorMW({
    validator: createUserValidator,
    validateOn: 'body',
});

const searchUsersValidatorMW = validatorMW({
    validator: searchUsersValidator,
    validateOn: 'body',
});

const router = Router();

router.post('/create', createUserValidatorMW, userController.createUser);

router.post(
    '/search',
    authJwtMW,
    searchUsersValidatorMW,
    userController.searchUsers,
);

router.get('/details', authJwtMW, userController.getUser);

export default router;
