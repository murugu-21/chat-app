import { MessageSquare } from 'lucide-react';

export default function EmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p>Select a conversation to start chatting</p>
        </div>
    );
}
