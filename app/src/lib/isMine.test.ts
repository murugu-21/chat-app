import { describe, expect, it } from 'vitest';
import { isMine } from './isMine';

describe('isMine', () => {
    it('true when the message sender matches my email', () => {
        expect(isMine({ createdBy: { email: 'me@x.com' } }, 'me@x.com')).toBe(true);
    });
    it('false for a different sender', () => {
        expect(isMine({ createdBy: { email: 'them@x.com' } }, 'me@x.com')).toBe(false);
    });
    it('false when my email is null', () => {
        expect(isMine({ createdBy: { email: 'them@x.com' } }, null)).toBe(false);
    });
});
