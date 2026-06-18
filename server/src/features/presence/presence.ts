// In-memory presence: email -> active socket connection count. Single-instance
// only (ASG maxCapacity=1); see the spec's "Scaling" note for the Redis path.
const counts = new Map<string, number>();

export const addConnection = (email: string): boolean => {
    const next = (counts.get(email) ?? 0) + 1;
    counts.set(email, next);
    return next === 1; // true on 0 -> 1 (just came online)
};

export const removeConnection = (email: string): boolean => {
    const current = counts.get(email) ?? 0;
    if (current <= 0) return false;
    if (current === 1) {
        counts.delete(email);
        return true; // 1 -> 0 (just went offline)
    }
    counts.set(email, current - 1);
    return false;
};

export const onlineEmails = (): string[] => [...counts.keys()];
export const isOnline = (email: string): boolean => (counts.get(email) ?? 0) > 0;

// test-only reset
export const __reset = (): void => counts.clear();
