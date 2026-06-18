import { Router } from 'express';
import { validatorMW } from '../../middleware/validator.middleware.js';
import { searchUsersValidator } from './user.validator.js';
import * as userController from './user.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const searchUsersValidatorMW = validatorMW({
    validator: searchUsersValidator,
    validateOn: 'body',
});

const router = Router();

router.post('/search', requireAuth, searchUsersValidatorMW, userController.searchUsers);

router.get('/details', requireAuth, userController.getUser);

export default router;
