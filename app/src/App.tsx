import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router';
import LoginPage from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Chat from './pages/Chat';
import Landing from './pages/Landing';
import { Toaster } from 'sonner';
import ProtectedRoute from './Provider/ProtectedRoute';
import NotFound from './pages/utils/NotFound';
import useOnline from './hooks/useOnline';
import NoInternet from './pages/utils/NoInternet';
import ApiHealthGate from './components/ApiHealthGate';
import ChatLayout from '@/layouts/ChatLayout';
import EmptyState from '@/components/chat/EmptyState';

function App() {
    const { online } = useOnline();
    return (
        <>
            <Toaster />
            <BrowserRouter>
                <Routes>
                    {online ? (
                        <>
                            <Route path="/" element={<Landing />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />
                            <Route path="/chat" element={<ApiHealthGate><ProtectedRoute /></ApiHealthGate>}>
                                <Route element={<ChatLayout />}>
                                    <Route index element={<EmptyState />} />
                                    <Route path=":chatId" element={<Chat />} />
                                </Route>
                            </Route>

                            <Route path="*" element={<NotFound />} />
                        </>
                    ) : (
                        <Route path="*" element={<NoInternet />}></Route>
                    )}
                </Routes>
            </BrowserRouter>
        </>
    );
}

export default App;
