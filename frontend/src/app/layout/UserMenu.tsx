import { LayoutGridIcon, LogOutIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout, useSession } from '@/features/auth/queries';
import { useAuthDialog } from '@/hooks/useAuthDialog';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function UserMenu() {
  const { user, isLoading } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const auth = useAuthDialog();

  if (isLoading) return <Skeleton className="size-8 rounded-full" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          onClick={auth.intercept({ mode: 'login' })}
          className={buttonVariants({ variant: 'ghost' })}
        >
          Log in
        </Link>
        <Link
          to="/register"
          onClick={auth.intercept({ mode: 'register' })}
          className={buttonVariants()}
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />
        }
      >
        <Avatar>
          <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI requires labels to live inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="font-medium">{user.displayName}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => navigate('/boards')}>
            <LayoutGridIcon /> My boards
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            // Leave the protected page first so the route guard has nothing to redirect.
            navigate('/');
            logout.mutate();
          }}
        >
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
