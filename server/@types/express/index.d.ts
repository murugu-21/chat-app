import { ChatT } from '../../src/features/chat/chat.model.ts';
import { UserT } from '../../src/features/user/user.model.ts';

declare global {
    namespace Express {
        interface Request {
            id: string;
            user: UserT;
            chat: ChatT;
        }
    }
}

export {};
