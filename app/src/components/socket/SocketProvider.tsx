import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BACKEND_URL } from '../../env';
import { getToken } from '../../lib/auth';

type Ctx = { socket: Socket; isOnline: (email: string) => boolean };
const SocketContext = createContext<Ctx | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
    const socketRef = useRef<Socket | null>(null);
    if (!socketRef.current) {
        socketRef.current = io(BACKEND_URL, { autoConnect: false, auth: (cb) => cb({ token: getToken() }) });
    }
    const socket = socketRef.current;
    const [online, setOnline] = useState<Set<string>>(new Set());

    useEffect(() => {
        const onState = (emails: string[]) => setOnline(new Set(emails));
        const onUpdate = ({ email, online: isUp }: { email: string; online: boolean }) =>
            setOnline((prev) => {
                const next = new Set(prev);
                if (isUp) next.add(email); else next.delete(email);
                return next;
            });
        socket.on('presence:state', onState);
        socket.on('presence:update', onUpdate);
        socket.connect();
        return () => {
            socket.off('presence:state', onState);
            socket.off('presence:update', onUpdate);
            socket.disconnect();
        };
    }, [socket]);

    const isOnline = (email: string) => online.has(email);
    return <SocketContext.Provider value={{ socket, isOnline }}>{children}</SocketContext.Provider>;
}

export function useSocketCtx(): Ctx {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocketCtx must be used within SocketProvider');
    return ctx;
}

export function usePresence() {
    return { isOnline: useSocketCtx().isOnline };
}
