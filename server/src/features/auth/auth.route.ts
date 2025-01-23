import { Router } from 'express';
import { validatorMW } from '../../middleware/validator.middleware.js';
import { changePasswordValidator } from './auth.validator.js';
import * as authController from './auth.controller.js';
import { userNamePasswordMW } from '../../lib/passport/index.js';

const changePasswordValidatorMW = validatorMW({
    validator: changePasswordValidator,
    validateOn: 'body',
});

const router = Router();

router.post(
    '/changePassword',
    changePasswordValidatorMW,
    authController.changePassword,
);

router.post('/login', userNamePasswordMW, authController.login);

export default router;
