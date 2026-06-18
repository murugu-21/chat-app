import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SendHorizontal } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

const schema = z.object({ content: z.string().min(1) });
type Form = z.infer<typeof schema>;

export function Composer({ onSend }: { onSend: (content: string) => Promise<void> }) {
    const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
    const submit = handleSubmit(async ({ content }) => { await onSend(content); reset(); });
    return (
        <form onSubmit={submit} className="flex items-end gap-2 border-t p-3">
            <Textarea
                {...register('content')}
                placeholder="Type a message…"
                rows={1}
                className="min-h-10 max-h-40 resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            />
            <Button type="submit" size="icon" disabled={isSubmitting}><SendHorizontal className="h-4 w-4" /><span className="sr-only">Send</span></Button>
        </form>
    );
}
