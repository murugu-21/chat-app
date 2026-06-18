import { describe, expect, it, vi } from 'vitest';
import { makeStamper } from './activity.js';

describe('makeStamper', () => {
    it('writes epoch seconds to the file on first call', () => {
        const write = vi.fn();
        const stamp = makeStamper({ file: '/tmp/act', throttleMs: 1000, now: () => 60_000, write });
        stamp();
        expect(write).toHaveBeenCalledWith('/tmp/act', '60');
    });

    it('throttles within the window and resumes after it', () => {
        const write = vi.fn();
        let t = 0;
        const stamp = makeStamper({ file: '/tmp/act', throttleMs: 1000, now: () => t, write });
        t = 0; stamp();          // writes
        t = 500; stamp();        // throttled
        t = 1500; stamp();       // writes
        expect(write).toHaveBeenCalledTimes(2);
    });

    it('is a no-op when no file is configured', () => {
        const write = vi.fn();
        const stamp = makeStamper({ file: undefined, throttleMs: 1000, now: () => 0, write });
        stamp();
        expect(write).not.toHaveBeenCalled();
    });
});
