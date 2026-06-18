import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router';
import LoginPage from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Home from './pages/Home';
import Chat from './pages/Chat';
import { Toaster } from 'sonner';
import ProtectedRoute from './Provider/ProtectedRoute';
import NotFound from './pages/utils/NotFound';
import useOnline from './hooks/useOnline';
import NoInternet from './pages/utils/NoInternet';
import ApiHealthGate from './components/ApiHealthGate';

function App() {
    const { online } = useOnline();
    return (
        <>
            <Toaster />
            <BrowserRouter>
                <Routes>
                    {online ? (
                        <>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/auth/callback" element={<AuthCallback />} />
                            <Route element={<ApiHealthGate><ProtectedRoute /></ApiHealthGate>}>
                                <Route index element={<Home />} />
                                <Route
                                    path="chat/:chatId"
                                    element={<Chat />}
                                />
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
