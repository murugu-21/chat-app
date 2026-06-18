import { ServerCrash } from 'lucide-react';

export default function SiteDown(): JSX.Element {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
            <ServerCrash className="h-10 w-10" />
            <p>Something went wrong</p>
        </div>
    );
}
