import { z } from 'zod';

const createChatValidator = z.object({
    email: z.string().email(),
});

export { createChatValidator };
