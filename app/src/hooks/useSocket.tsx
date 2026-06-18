import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { BACKEND_URL } from '../env';
import { getToken } from '../lib/auth';

export function useSocket() {
    // Create the socket ONCE (not on every render) — otherwise each re-render
    // spawns a new connection, causing connect/disconnect churn that drops the
    // room join and the 'message' listener, so live updates silently stop.
    const socketRef = useRef<Socket | null>(null);
    if (!socketRef.current) {
        socketRef.current = io(BACKEND_URL, {
            autoConnect: false,
            auth: (cb) => cb({ token: getToken() }),
        });
    }
    const socket = socketRef.current;

    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, [socket]);

    return { socket };
}
