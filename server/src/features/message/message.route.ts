import { Router } from 'express';
import { validatorMW } from '../../middleware/validator.middleware.js';
import {
    listMessagesOfChatValidator,
    sendMessageValidator,
} from './message.validator.js';
import { authJwtMW } from '../../lib/passport/index.js';
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
    authJwtMW,
    sendMessageValidatorMW,
    loadChatForUser,
    messageController.sendMessage,
);

router.get(
    '/list/:chatId',
    authJwtMW,
    listMessagesOfChatValidatorMW,
    loadChatForUser,
    messageController.listMessagesOfChat,
);

export default router;
