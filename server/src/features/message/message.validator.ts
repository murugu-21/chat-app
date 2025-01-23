import { z } from 'zod';
import nanoIdRegex from '../../utils/nanoIdRegex.js';

const sendMessageValidator = z.object({
    chatId: z.string().regex(nanoIdRegex),
    message: z.string().min(1).max(280),
});

const listMessagesOfChatValidator = z.object({
    chatId: z.string().regex(nanoIdRegex),
});

export { sendMessageValidator, listMessagesOfChatValidator };
