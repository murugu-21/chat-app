import useSWR from 'swr';
import { useNavigate, useParams } from 'react-router';
import fetcher from '@/utils/fetcher';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

type Chat = { chatId: string; chatName: string };

export function ConversationList() {
    const { data: chats, isLoading } = useSWR<Chat[]>('chat/list', fetcher);
    const navigate = useNavigate();
    const { chatId: activeId } = useParams();

    if (isLoading) {
        return (
            <div className="space-y-1 p-2">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <nav className="flex-1 overflow-y-auto p-2">
            {(chats ?? []).map((chat) => (
                <button
                    key={chat.chatId}
                    onClick={() => navigate(`/chat/${chat.chatId}`)}
                    className={cn(
                        'flex w-full items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent',
                        chat.chatId === activeId && 'bg-accent',
                    )}
                >
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>{chat.chatName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{chat.chatName}</span>
                </button>
            ))}
        </nav>
    );
}
