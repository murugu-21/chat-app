import { Router } from 'express';

import { validatorMW } from '../../middleware/validator.middleware.js';
import { createChatValidator } from './chat.validator.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import * as chatController from './chat.controller.js';

const createChatValidatorMW = validatorMW({
    validator: createChatValidator,
    validateOn: 'body',
});

const router = Router();

router.post(
    '/create',
    requireAuth,
    createChatValidatorMW,
    chatController.createChat,
);

router.get(
    '/list',
    requireAuth,
    chatController.listChatsOfUser,
);

export default router;
