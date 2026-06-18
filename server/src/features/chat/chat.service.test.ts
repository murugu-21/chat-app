import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { userModel } from '../user/user.model.js';
import { chatModel } from './chat.model.js';
import { listChatsOfUser } from './chat.service.js';

let mongod: MongoMemoryServer;
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri(), { dbName: 'test' }); });
afterAll(async () => { await mongoose.disconnect(); await mongod.stop(); });

describe('listChatsOfUser enrichment', () => {
    it('attaches each peer user\'s avatarUrl by chatName', async () => {
        const me = await userModel.create({ email: 'me@x.com' });
        await userModel.create({ email: 'peer@x.com', avatarUrl: 'https://pic/peer.png' });
        await chatModel.create({ userId: me._id, chatId: 'c1', chatName: 'peer@x.com' });
        const chats = await listChatsOfUser(me._id.toString());
        expect(chats).toHaveLength(1);
        expect(chats[0].chatName).toBe('peer@x.com');
        expect(chats[0].avatarUrl).toBe('https://pic/peer.png');
    });
});
