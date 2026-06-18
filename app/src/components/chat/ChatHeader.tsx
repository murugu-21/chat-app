import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function ChatHeader({ name }: { name: string }) {
    const navigate = useNavigate();
    return (
        <div className="flex items-center gap-3 border-b p-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => navigate('/')}><ChevronLeft className="h-4 w-4" /></Button>
            <Avatar className="h-8 w-8"><AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <span className="font-medium">{name}</span>
        </div>
    );
}
