import { io } from 'socket.io-client';
import { useEffect } from 'react';
import { BACKEND_URL } from '../env';
import { getToken } from '../lib/auth';

export function useSocket() {
    const socket = io(BACKEND_URL, {
        autoConnect: false,
        auth: (cb) => cb({ token: getToken() }),
    });
    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, []);
    return { socket };
}
