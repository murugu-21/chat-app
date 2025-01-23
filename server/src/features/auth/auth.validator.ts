import z from 'zod';

const changePasswordValidator = z.object({
    otp: z.string().uuid(),
    newPassword: z
        .string()
        .min(8)
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        ),
});

export { changePasswordValidator };
