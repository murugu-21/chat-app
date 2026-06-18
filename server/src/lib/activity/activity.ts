import { writeFile } from 'node:fs/promises';

type Opts = {
    file?: string;
    throttleMs?: number;
    now?: () => number;
    // injectable for tests; default fire-and-forget async write that never throws
    write?: (file: string, data: string) => void;
};

const defaultWrite = (file: string, data: string): void => {
    void writeFile(file, data).catch(() => {});
};

export const makeStamper = (opts: Opts): (() => void) => {
    const throttleMs = opts.throttleMs ?? 10_000;
    const now = opts.now ?? (() => Date.now());
    const write = opts.write ?? defaultWrite;
    let last = -Infinity;
    return () => {
        if (!opts.file) return;
        const ms = now();
        if (ms - last < throttleMs) return;
        last = ms;
        write(opts.file, String(Math.floor(ms / 1000)));
    };
};
