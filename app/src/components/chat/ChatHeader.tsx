import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';

export function ChatHeader({ name, avatarUrl, online }: { name: string; avatarUrl?: string; online: boolean }) {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-3 border-b p-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/chat')}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Back</span></Button>
            <UserAvatar email={name} src={avatarUrl} className="h-8 w-8" />
            <div className="flex flex-col">
                <span className="font-medium leading-tight">{name}</span>
                <span className="text-xs text-muted-foreground">{online ? 'Online' : 'Offline'}</span>
            </div>
        </div>
    );
}
