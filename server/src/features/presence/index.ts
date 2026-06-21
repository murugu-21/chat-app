import { makeMemoryPresence } from './presence.memory.js';
import type { Presence } from './types.js';

// Selects the presence implementation. Task 3 adds the Redis branch; for now
// the in-memory implementation is always used.
export const selectPresence = (_client: unknown | null): Presence => {
    return makeMemoryPresence();
};

export const presence: Presence = selectPresence(null);
