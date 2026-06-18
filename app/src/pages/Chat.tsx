import { useParams } from 'react-router';
import useSWR from 'swr';
import { useEffect, type JSX} from 'react';
import fetcher from '@/utils/fetcher';
import { useSocket } from '@/hooks/useSocket';
import { usePresence } from '@/components/socket/SocketProvider';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { Composer } from '@/components/chat/Composer';
import { Skeleton } from '@/components/ui/skeleton';
import SiteDown from './utils/SiteDown';

type Message = { _id: string; content: string; createdBy: { email: string } };
type Chat = { chatId: string; chatName: string; avatarUrl?: string };

export default function Chat(): JSX.Element {
    const { socket } = useSocket();
    const { chatId } = useParams();
    const { data: messages, isLoading, error, mutate } =
        useSWR<Message[]>(chatId ? `message/list/${chatId}` : null, fetcher);
    const { data: chats } = useSWR<Chat[]>('chat/list', fetcher);
    const peer = (chats ?? []).find((c) => c.chatId === chatId);
    const name = peer?.chatName ?? 'Conversation';
    const { isOnline } = usePresence();

    useEffect(() => {
        const join = () => socket.emit('join', chatId);
        join(); // join now if already connected…
        socket.on('connect', join); // …and re-join after any reconnect
        socket.on('message', () => { mutate(); });
        return () => {
            socket.emit('leave', chatId);
            socket.off('connect', join);
            socket.off('message');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

    const send = async (content: string) => {
        await fetcher('message/send', {
            method: 'POST',
            headers: { 'Content-type': 'application/json' },
            body: JSON.stringify({ chatId, content }),
        });
    };

    if (!chatId) return <SiteDown />;
    if (isLoading) return <div className="flex-1 space-y-3 p-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-64 ml-auto" /></div>;
    if (error || !messages) return <SiteDown />;

    return (
        <div className="flex h-full flex-col">
            <ChatHeader name={name} avatarUrl={peer?.avatarUrl} online={isOnline(name)} />
            <MessageList messages={messages} />
            <Composer onSend={send} />
        </div>
    );
}
