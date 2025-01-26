import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router';
import useSWR from 'swr';
import { z } from 'zod';

import fetcher from '../utils/fetcher';
import FullPageLoader from './utils/FullPageLoader';
import SiteDown from './utils/SiteDown';
import { useSocket } from '../hooks/useSocket';
import { useEffect } from 'react';

const createMessageSchema = z.object({
    content: z.string().min(1),
});

type createMessageSchemaT = z.infer<typeof createMessageSchema>;

export default function Chat(): JSX.Element {
    const { socket } = useSocket();
    const { chatId } = useParams();
    const {
        data: messages,
        isLoading,
        error,
        mutate
    } = useSWR<
        Array<{ _id: string; content: string; createdBy: { email: string } }>
    >(chatId ? `message/list/${chatId}` : null, fetcher);
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<createMessageSchemaT>({
        resolver: zodResolver(createMessageSchema),
    });
    const onSubmit = handleSubmit(async (data) => {
        await fetcher(`message/send`, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
            },
            body: JSON.stringify({ chatId, content: data.content }),
        });
        if (chatId) {
            reset();
            // await mutate();
        }
    });
    useEffect(() => {
        socket.emit('join', chatId);
        socket.on('message', (msg: string) => {
            window.console.log("message from server", msg);
            mutate();
        });
        return () => {
            socket.emit('leave', chatId);
            socket.off('message');
        };
    }, [chatId]);

    if (isLoading) {
        return <FullPageLoader />
    }

    if (error || !messages) {
        return <SiteDown />
    }
    
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
