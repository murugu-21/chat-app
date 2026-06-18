import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import fetcher from '@/utils/fetcher';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const schema = z.object({ query: z.string().min(3) });
type Form = z.infer<typeof schema>;
type User = { _id: string; email: string };
type Chat = { chatId: string; chatName: string };

export function UserSearch() {
    const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
    const [users, setUsers] = useState<User[]>([]);
    const navigate = useNavigate();
    const { data: chats } = useSWR<Chat[]>('chat/list', fetcher);

    const onSubmit = handleSubmit(async (data) => {
        setUsers(await fetcher<User[]>('user/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        }));
    });

    const startChat = async (user: User) => {
        const existing = (chats ?? []).find((c) => c.chatName === user.email);
        const chatId = existing?.chatId ?? await fetcher<string>('chat/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
        });
        navigate(`/chat/${chatId}`);
    };

    return (
        <div className="border-b p-3">
            <form onSubmit={onSubmit} className="flex gap-2">
                <Input placeholder="Search users by email…" {...register('query')} />
                <Button type="submit" size="sm">Search</Button>
            </form>
            {errors.query && <p className="mt-1 text-xs text-destructive">{errors.query.message}</p>}
            {users.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {users.map((u) => (
                        <li key={u._id} className="flex items-center justify-between gap-2 rounded-md p-1 text-sm">
                            <span className="truncate">{u.email}</span>
                            <Button size="sm" variant="secondary" onClick={() => startChat(u)}>Message</Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
