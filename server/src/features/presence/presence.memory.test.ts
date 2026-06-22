import { beforeEach, describe, expect, it } from 'vitest';

import { makeMemoryPresence } from './presence.memory.js';
import type { Presence } from './types.js';

describe('memory presence registry', () => {
    let presence: Presence;
    beforeEach(() => {
        presence = makeMemoryPresence();
    });

    it('first connection marks online (0->1 returns true)', async () => {
        expect(await presence.addConnection('a@x.com')).toBe(true);
        expect(await presence.isOnline('a@x.com')).toBe(true);
        expect(await presence.onlineEmails()).toEqual(['a@x.com']);
    });

    it('second connection does not re-signal online', async () => {
        await presence.addConnection('a@x.com');
        expect(await presence.addConnection('a@x.com')).toBe(false);
    });

    it('offline only when the last connection drops', async () => {
        await presence.addConnection('a@x.com');
        await presence.addConnection('a@x.com');
        expect(await presence.removeConnection('a@x.com')).toBe(false);
        expect(await presence.removeConnection('a@x.com')).toBe(true);
        expect(await presence.isOnline('a@x.com')).toBe(false);
    });

    it('removeConnection on an unknown email returns false', async () => {
        expect(await presence.removeConnection('nope@x.com')).toBe(false);
    });

    it('reset clears all counts', async () => {
        await presence.addConnection('a@x.com');
        await presence.reset();
        expect(await presence.onlineEmails()).toEqual([]);
    });
});
