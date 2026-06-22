import type { Presence } from './types.js';

// In-memory presence: email -> active socket connection count. Correct for a
// single instance (ASG maxCapacity=1); the Redis impl is used when REDIS_URL is set.
export const makeMemoryPresence = (): Presence => {
    const counts = new Map<string, number>();
    return {
        async addConnection(email) {
            const next = (counts.get(email) ?? 0) + 1;
            counts.set(email, next);
            return next === 1;
        },
        async removeConnection(email) {
            const current = counts.get(email) ?? 0;
            if (current <= 0) return false;
            if (current === 1) {
                counts.delete(email);
                return true;
            }
            counts.set(email, current - 1);
            return false;
        },
        async onlineEmails() {
            return [...counts.keys()];
        },
        async isOnline(email) {
            return (counts.get(email) ?? 0) > 0;
        },
        async reset() {
            counts.clear();
        },
    };
};
