import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PresenceDot } from './PresenceDot';
import { gravatarUrl } from '@/lib/gravatar';
import { cn } from '@/lib/utils';

export function UserAvatar({
    email,
    src,
    online,
    className,
}: {
    email: string;
    src?: string | null;
    online?: boolean;
    className?: string;
}) {
    const [gravatar, setGravatar] = useState<string | undefined>();
    useEffect(() => {
        if (src) return; // explicit URL wins; skip gravatar work
        let cancelled = false;
        gravatarUrl(email).then((u) => { if (!cancelled) setGravatar(u); });
        return () => { cancelled = true; };
    }, [email, src]);

    const imageSrc = src || gravatar;
    const initials = email.slice(0, 2).toUpperCase();

    return (
        <span className={cn('relative inline-block', className)}>
            <Avatar className="h-9 w-9">
                {imageSrc ? <AvatarImage src={imageSrc} alt={email} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {online !== undefined && (
                <PresenceDot online={online} className="absolute -bottom-0.5 -right-0.5" />
            )}
        </span>
    );
}
