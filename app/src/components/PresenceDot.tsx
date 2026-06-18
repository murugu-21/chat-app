import { cn } from '@/lib/utils';

export function PresenceDot({ online, className }: { online: boolean; className?: string }) {
    return (
        <span
            className={cn(
                'block h-3 w-3 rounded-full ring-2 ring-background',
                online ? 'bg-green-500' : 'bg-muted-foreground/40',
                className,
            )}
            aria-label={online ? 'Online' : 'Offline'}
        />
    );
}
