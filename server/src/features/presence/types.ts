// Presence registry: email -> online, tracked by active socket connection count.
// Async so a Redis-backed implementation can satisfy the same contract.
export interface Presence {
    addConnection(email: string): Promise<boolean>; // true on 0 -> 1
    removeConnection(email: string): Promise<boolean>; // true on 1 -> 0
    onlineEmails(): Promise<string[]>;
    isOnline(email: string): Promise<boolean>;
    reset(): Promise<void>; // boot reset / test reset
}
