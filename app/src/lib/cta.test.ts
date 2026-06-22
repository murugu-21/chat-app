import { describe, it, expect } from 'vitest';

import { ctaAction } from './cta';

describe('ctaAction', () => {
    it('returns open when a token is present', () => {
        expect(ctaAction('id-token')).toEqual({ kind: 'open' });
    });

    it('returns signin when there is no token', () => {
        expect(ctaAction(null)).toEqual({ kind: 'signin' });
    });
});
