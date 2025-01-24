import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import { z } from 'zod';

const createMessageSchema = z.object({
    content: z.string().min(1),
});

type createMessageSchemaT = z.infer<typeof createMessageSchema>;

export default function Chat(): JSX.Element {
    const { chatId } = useParams();
    const [messages, setMessages] = useState<
        Array<{ _id: string; content: string; createdBy: { email: string } }>
    >([]);
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<createMessageSchemaT>({
        resolver: zodResolver(createMessageSchema),
    });
    const fetchMessages = async (chatId: string) => {
        const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/message/list/${chatId}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            },
        );
        if (res.ok) {
            const apiResponse = await res.json();
            setMessages(apiResponse.response);
        }
    };
    const onSubmit = handleSubmit(async (data) => {
        const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/message/send`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                    'Content-type': 'application/json',
                },
                body: JSON.stringify({ chatId, content: data.content }),
            },
        );
        if (res.ok && chatId) {
            reset();
            await fetchMessages(chatId);
        }
    });
    useEffect(() => {
        if (chatId) {
            fetchMessages(chatId);
        }
    }, [chatId]);
    if (!chatId) {
        return <div>Chat not found</div>;
    }

    return (
        <div className="flex flex-col gap-4 overflow-y-auto">
            {messages.map((message) => (
                <div key={message._id} className="flex flex-col gap-1">
                    <div>{message.createdBy.email}</div>
                    <div>{message.content}</div>
                </div>
            ))}
            <form onSubmit={onSubmit}>
                <textarea {...register('content')} />
                {errors.content && (
                    <p className="text-red-500 text-xs italic">
                        {errors.content.message}
                    </p>
                )}
                <button
                    className="bg-blue-500 hover:bg-blue-700 disabled:bg-blue-100 disabled:cursor-not-allowed cursor-pointer text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                    type="submit"
                >
                    send
                </button>
            </form>
        </div>
    );
}
