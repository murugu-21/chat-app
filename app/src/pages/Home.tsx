import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import useSWR from 'swr';
import fetcher from '../utils/fetcher';
import FullPageLoader from './utils/FullPageLoader';
import SiteDown from './utils/SiteDown';
import { useNavigate } from 'react-router';
import Button from '../components/Button';

const searchSchema = z.object({
    query: z.string().min(3),
});

type SearchSchemaT = z.infer<typeof searchSchema>;

export default function Home(): JSX.Element {
    const {
        data: chats,
        isLoading,
        error,
    } = useSWR<Array<{ chatId: string; chatName: string }>>(
        'chat/list',
        fetcher,
    );
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SearchSchemaT>({ resolver: zodResolver(searchSchema) });
    const [users, setUsers] = useState<Array<{ _id: string; email: string }>>(
        [],
    );
    const navigate = useNavigate();

    const onSubmit = handleSubmit(async (data) => {
        const newUsers = await fetcher<Array<{ _id: string; email: string }>>(
            'user/search',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            },
        );
        setUsers(newUsers);
    });

    const handleChat = async (
        chats: Array<{ chatId: string; chatName: string }>,
        user: {email: string},
    ) => {
        const chat = chats.find((chat) => chat.chatName === user.email);
        let chatId = chat?.chatId;
        if (!chatId) {
            chatId = await fetcher('chat/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: user.email,
                }),
            });
        }
        navigate(`chat/${chatId}`);
    };

    if (isLoading) {
        return <FullPageLoader />;
    }

    if (error || !chats) {
        return <SiteDown />;
    }

    return (
        <div className="p-16 flex flex-col gap-4 justify-center items-start">
            <div className="flex justify-end">
                <form onSubmit={onSubmit}>
                    <input
                        className={`shadow appearance-none border ${
                            errors.query ? 'border-red-500' : ''
                        } rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline`}
                        {...register('query')}
                    />
                    {errors.query && (
                        <p className="text-red-500 text-xs italic">
                            {errors.query.message}
                        </p>
                    )}
                    <Button
                        className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-100 disabled:cursor-not-allowed cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        type="submit"
                        onClick={onSubmit}
                    >
                        <span>search</span>
                    </Button>
                </form>
            </div>
            {users.length > 0 ? (
                <div className="flex flex-col gap-2 justify-center items-center">
                    {users.map((user) => (
                        <div className="flex flex-col gap-1" key={user._id}>
                            <span>{user.email}</span>
                            <Button
                                className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-100 disabled:cursor-not-allowed cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                type="submit"
                                onClick={() => handleChat(chats, user)}
                            >
                                <span>chat</span>
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 flex flex-col gap-2 justify-center items-center">
                    {chats.map((chat) => (
                        <div>
                            <div
                                className="cursor-pointer"
                                onClick={() => navigate(`chat/${chat.chatId}`)}
                            >
                                {chat.chatName}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
