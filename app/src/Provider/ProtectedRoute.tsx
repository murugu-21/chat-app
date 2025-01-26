import { Navigate, Outlet } from 'react-router';
import { jwtDecode } from 'jwt-decode';

export default function ProtectedRoute() {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate replace to="/login" />;
    }
    try {
        const decoded = jwtDecode(token as string);
        if (
            (decoded.exp || Number.MAX_SAFE_INTEGER) <
            Math.floor(Date.now() / 1000)
        ) {
            return <Navigate replace to="/login" />;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e: unknown) {
        localStorage.removeItem('token');
        return <Navigate replace to="/login" />;
    }
    return <Outlet />;
}
