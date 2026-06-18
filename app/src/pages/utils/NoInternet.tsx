import { WifiOff } from 'lucide-react';

export default function NoInternet(): JSX.Element {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
            <WifiOff className="h-10 w-10" />
            <p>You're offline</p>
        </div>
    );
}
