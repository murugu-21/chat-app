import { cn } from '@/lib/utils';

export function MessageBubble({ content, mine }: { content: string; mine: boolean }) {
    return (
        <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2 text-sm break-words',
                mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            )}>
                {content}
            </div>
        </div>
    );
}
