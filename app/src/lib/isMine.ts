export const isMine = (
    message: { createdBy: { email: string } },
    myEmail: string | null,
): boolean => myEmail != null && message.createdBy.email === myEmail;
