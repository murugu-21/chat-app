import z from 'zod';

const createUserValidator = z.object({
    email: z.string().email(),
});

const searchUsersValidator = z.object({
    query: z.string().min(3),
});

export { createUserValidator, searchUsersValidator };
