import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // mongodb-memory-server downloads a binary on first run; give it room.
        testTimeout: 30000,
        hookTimeout: 30000,
        setupFiles: ['src/__tests__/setup.ts'],
    },
});
