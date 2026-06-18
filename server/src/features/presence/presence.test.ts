import { beforeEach, describe, expect, it } from 'vitest';
import { addConnection, removeConnection, onlineEmails, isOnline, __reset } from './presence.js';

describe('presence registry', () => {
    beforeEach(() => __reset());
    it('first connection marks online (0->1 returns true)', () => {
        expect(addConnection('a@x.com')).toBe(true);
        expect(isOnline('a@x.com')).toBe(true);
        expect(onlineEmails()).toEqual(['a@x.com']);
    });
    it('second connection does not re-signal online', () => {
        addConnection('a@x.com');
        expect(addConnection('a@x.com')).toBe(false); // already online
    });
    it('offline only when the last connection drops', () => {
        addConnection('a@x.com'); addConnection('a@x.com');
        expect(removeConnection('a@x.com')).toBe(false); // still 1 left
        expect(isOnline('a@x.com')).toBe(true);
        expect(removeConnection('a@x.com')).toBe(true); // last one -> offline
        expect(isOnline('a@x.com')).toBe(false);
        expect(onlineEmails()).toEqual([]);
    });
    it('removing an unknown email is a no-op', () => {
        expect(removeConnection('ghost@x.com')).toBe(false);
    });
});
