import { Outlet, useParams } from 'react-router';
import { Sidebar } from '@/components/chat/Sidebar';
import { SocketProvider } from '@/components/socket/SocketProvider';
import { cn } from '@/lib/utils';

export default function ChatLayout() {
    const { chatId } = useParams();
    return (
        <SocketProvider>
            <div className="flex h-screen w-full overflow-hidden">
                <div className={cn('w-full md:w-80 md:block', chatId && 'hidden md:block')}>
                    <Sidebar />
                </div>
                <main className={cn('flex-1 flex-col overflow-hidden', chatId ? 'flex' : 'hidden md:flex')}>
                    <Outlet />
                </main>
            </div>
        </SocketProvider>
    );
}
