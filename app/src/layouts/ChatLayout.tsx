import { Outlet } from 'react-router';
import { Sidebar } from '@/components/chat/Sidebar';

export default function ChatLayout() {
    return (
        <div className="flex h-screen w-full overflow-hidden">
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
