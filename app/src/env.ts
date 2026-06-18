const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN;
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const REDIRECT_URI =
    import.meta.env.VITE_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
const WAKE_URL = import.meta.env.VITE_WAKE_URL;

// Temporary alias to BACKEND_URL for backward compatibility with useSocket.tsx
// TODO: Task 5 will update useSocket.tsx to use BACKEND_URL directly
const WEBSOCKET_URL = BACKEND_URL;

export { BACKEND_URL, COGNITO_DOMAIN, COGNITO_CLIENT_ID, REDIRECT_URI, WAKE_URL, WEBSOCKET_URL }
