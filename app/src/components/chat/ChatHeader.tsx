import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function ChatHeader({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-3 border-b p-3">
            <Avatar className="h-8 w-8"><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <span className="font-medium">{name}</span>
        </div>
    );
}
