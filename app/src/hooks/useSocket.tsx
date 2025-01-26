import { io } from 'socket.io-client';
import { useEffect } from 'react';

import { WEBSOCKET_URL } from '../env';

export function useSocket() {
    const socket = io(WEBSOCKET_URL, {
        autoConnect: false,
        extraHeaders: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
    });
    useEffect(() => {
        socket.connect();
        return () => {
            socket.disconnect();
        };
    }, []);
    return { socket };
}
