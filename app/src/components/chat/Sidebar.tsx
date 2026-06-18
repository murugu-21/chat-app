import { LogOut } from 'lucide-react';
import { getEmail, logout } from '@/lib/auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ModeToggle } from '@/components/theme/mode-toggle';
import { UserSearch } from './UserSearch';
import { ConversationList } from './ConversationList';

export function Sidebar() {
    const email = getEmail() ?? 'You';
    return (
        <aside className="flex h-full w-full flex-col border-r bg-background md:w-80">
            <div className="flex items-center justify-between border-b p-3">
                <span className="font-semibold">Chat app</span>
                <div className="flex items-center gap-1">
                    <ModeToggle />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Avatar className="h-7 w-7"><AvatarFallback>{email.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                                <span className="sr-only">Account menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => logout()}>
                                <LogOut className="mr-2 h-4 w-4" /> Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <UserSearch />
            <ConversationList />
        </aside>
    );
}
