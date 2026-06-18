import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { isMine } from '@/lib/isMine';
import { getEmail } from '@/lib/auth';

type Message = { _id: string; content: string; createdBy: { email: string } };

export function MessageList({ messages }: { messages: Message[] }) {
    const myEmail = getEmail();
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
    return (
        <ScrollArea className="flex-1 px-4 py-4">
            <div className="flex flex-col gap-2">
                {messages.map((m) => (
                    <MessageBubble key={m._id} content={m.content} mine={isMine(m, myEmail)} />
                ))}
                <div ref={bottomRef} />
            </div>
        </ScrollArea>
    );
}
