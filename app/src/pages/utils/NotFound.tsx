import { FileQuestion } from 'lucide-react';

export default function NotFound(): JSX.Element {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p>Page not found</p>
        </div>
    );
}
