import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const searchSchema = z.object({
    query: z.string().min(3),
});

type SearchSchemaT = z.infer<typeof searchSchema>;

export default function Home(): JSX.Element {
    const [chats, setChats] = useState<
        Array<{ chatId: string; chatName: string }>
    >([]);
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<SearchSchemaT>({ resolver: zodResolver(searchSchema) });
    const [users, setUsers] = useState<Array<{ _id: string; email: string }>>(
        [],
    );
    useEffect(() => {
        const fetchChats = async () => {
            const res = await fetch(
                `${import.meta.env.VITE_BACKEND_URL}/chat/list`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem(
                            'token',
                        )}`,
                        Accept: 'application/json',
                    },
                },
            );
            if (res.ok) {
                const apiResponse = await res.json();
                setChats(apiResponse.response);
            }
        };
        fetchChats();
    }, []);
    const onSubmit = handleSubmit(async (data) => {
        const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/user/search`,
            {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json',
                },
            },
        );
        if (res.ok) {
            const apiResponse = await res.json();
            setUsers(apiResponse.response);
        }
    });
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
                    <button
                        className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-100 disabled:cursor-not-allowed cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        type="submit"
                    >
                        search
                    </button>
                </form>
            </div>
            {users.length > 0 ? (
                <div className="flex flex-col gap-2 justify-center items-center">
                    {users.map((user) => (
                        <div className="flex flex-col gap-1">
                            <span>{user.email}</span>
                            <button
                                className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-100 disabled:cursor-not-allowed cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                                onClick={async () => {
                                    const chat = chats.find(
                                        (chat) => chat.chatName === user.email,
                                    );
                                    if (chat) {
                                        window.location.href = `${window.location.origin}/chat/${chat.chatId}`;
                                    } else {
                                        const res = await fetch(
                                            `${
                                                import.meta.env.VITE_BACKEND_URL
                                            }/chat/create`,
                                            {
                                                method: 'POST',
                                                headers: {
                                                    Authorization: `Bearer ${localStorage.getItem(
                                                        'token',
                                                    )}`,
                                                    'Content-Type':
                                                        'application/json',
                                                },
                                                body: JSON.stringify({
                                                    email: user.email,
                                                }),
                                            },
                                        );
                                        if (res.ok) {
                                            const apiResponse =
                                                await res.json();
                                            window.location.href = `${window.location.origin}/chat/${apiResponse.response}`;
                                        }
                                    }
                                }}
                            >
                                chat
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-4 flex flex-col gap-2 justify-center items-center">
                    {chats.map((chat) => (
                        <div>
                            <div
                                className="cursor-pointer"
                                onClick={() =>
                                    (window.location.href = `${window.location.origin}/chat/${chat.chatId}`)
                                }
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
