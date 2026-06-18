import { useSocketCtx } from '@/components/socket/SocketProvider';

export function useSocket() {
    return { socket: useSocketCtx().socket };
}
