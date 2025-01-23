import { Router } from 'express';

import { validatorMW } from '../../middleware/validator.middleware.js';
import { createChatValidator } from './chat.validator.js';
import { authJwtMW } from '../../lib/passport/index.js';
import * as chatController from './chat.controller.js';

const createChatValidatorMW = validatorMW({
    validator: createChatValidator,
    validateOn: 'body',
});

const router = Router();

router.post(
    '/create',
    authJwtMW,
    createChatValidatorMW,
    chatController.createChat,
);

export default router;
