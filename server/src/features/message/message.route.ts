import { Router } from 'express';
import { validatorMW } from '../../middleware/validator.middleware.js';
import {
    listMessagesOfChatValidator,
    sendMessageValidator,
} from './message.validator.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import * as messageController from './message.controller.js';
import { loadChatForUser } from './message.middleware.js';

const sendMessageValidatorMW = validatorMW({
    validator: sendMessageValidator,
    validateOn: 'body',
});

const listMessagesOfChatValidatorMW = validatorMW({
    validator: listMessagesOfChatValidator,
    validateOn: 'params',
});

const router = Router();

router.post(
    '/send',
    requireAuth,
    sendMessageValidatorMW,
    loadChatForUser,
    messageController.sendMessage,
);

router.get(
    '/list/:chatId',
    requireAuth,
    listMessagesOfChatValidatorMW,
    loadChatForUser,
    messageController.listMessagesOfChat,
);

export default router;
