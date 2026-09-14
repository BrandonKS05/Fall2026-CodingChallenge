/**
 * Everything about who can see a board: the share link and the members.
 * Owners manage both; other members see the link and the list, and can leave.
 */
import type { Collection, GrantableRole } from '@trove/shared';
import { CheckIcon, CopyIcon, LinkIcon, Share2Icon, UserMinusIcon, UsersIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ApiError } from '@/lib/api';
import {
  useCreateShareLink,
  useInviteMember,
  useMembers,
  useRemoveMember,
  useRevokeShareLink,
  useUpdateMemberRole,
} from '../queries';
import { RolePicker } from './RolePicker';

interface SharePanelProps {
  board: Collection;
  currentUserId: string;
}

export function shareUrl(slug: string): string {
  return `${window.location.origin}/s/${slug}`;
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export function SharePanel({ board, currentUserId }: SharePanelProps) {
  const isOwner = board.role === 'owner';
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Share2Icon /> Share
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{board.title}”</DialogTitle>
          <DialogDescription>A link for anyone, or people who can work on it with you.</DialogDescription>
        </DialogHeader>
        <LinkSection board={board} isOwner={isOwner} />
        <Separator />
        <MembersSection board={board} isOwner={isOwner} currentUserId={currentUserId} enabled={open} />
      </DialogContent>
    </Dialog>
  );
}

function LinkSection({ board, isOwner }: { board: Collection; isOwner: boolean }) {
  const create = useCreateShareLink(board.id);
  const revoke = useRevokeShareLink(board.id);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!board.shareSlug) return;
    await navigator.clipboard.writeText(shareUrl(board.shareSlug));
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-2" aria-labelledby="share-link-heading">
      <h3 id="share-link-heading" className="flex items-center gap-2 text-sm font-medium">
        <LinkIcon className="size-4" /> Link
      </h3>
      {board.shareSlug ? (
        <>
          <div className="flex gap-2">
            <Input readOnly value={shareUrl(board.shareSlug)} aria-label="Share link" onFocus={(event) => event.target.select()} />
            <Button variant="outline" onClick={copy} aria-label="Copy link">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can view the board.
            {isOwner && (
              <>
                {' '}
                <button type="button" className="underline underline-offset-4" onClick={() => revoke.mutate()} disabled={revoke.isPending}>
                  Revoke link
                </button>
              </>
            )}
          </p>
        </>
      ) : isOwner ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {board.visibility === 'private'
              ? 'Creating a link makes the board “link only”: visible to anyone who has it.'
              : 'Anyone who has the link will be able to view.'}
          </p>
          <Button size="sm" onClick={() => create.mutate(undefined, { onSuccess: () => toast.success('Link created') })} disabled={create.isPending}>
            Create link
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">The owner has not created a link yet.</p>
      )}
    </section>
  );
}

interface MembersSectionProps {
  board: Collection;
  isOwner: boolean;
  currentUserId: string;
  enabled: boolean;
}

function MembersSection({ board, isOwner, currentUserId, enabled }: MembersSectionProps) {
  const members = useMembers(board.id, enabled);
  const invite = useInviteMember(board.id);
  const updateRole = useUpdateMemberRole(board.id);
  const remove = useRemoveMember(board.id);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<GrantableRole>('editor');
  const [error, setError] = useState<string | null>(null);

  function submitInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    invite.mutate(
      { email, role },
      {
        onSuccess: (member) => {
          setEmail('');
          toast.success(`${member.displayName} can now ${member.role === 'editor' ? 'edit' : 'view'} this board`);
        },
        onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'Could not invite.'),
      },
    );
  }

  function leave() {
    remove.mutate(currentUserId, {
      onSuccess: () => {
        toast.success(`You left “${board.title}”`);
        navigate('/boards');
      },
    });
  }

  return (
    <section className="space-y-3" aria-labelledby="members-heading">
      <h3 id="members-heading" className="flex items-center gap-2 text-sm font-medium">
        <UsersIcon className="size-4" /> People
      </h3>

      <ul className="max-h-56 space-y-1 overflow-y-auto" aria-label="Members">
        {(members.data ?? []).map((member) => {
          const isSelf = member.userId === currentUserId;
          return (
            <li key={member.userId} className="flex items-center gap-3 rounded-md px-1 py-1">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(member.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.displayName}
                  {isSelf && <span className="text-muted-foreground"> (you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
              {member.role === 'owner' ? (
                <Badge variant="secondary">Owner</Badge>
              ) : isOwner ? (
                <>
                  <RolePicker
                    label={`Role for ${member.displayName}`}
                    value={member.role}
                    disabled={updateRole.isPending}
                    onChange={(next) => updateRole.mutate({ userId: member.userId, role: next })}
                  />
                  <Button variant="ghost" size="icon" aria-label={`Remove ${member.displayName}`} onClick={() => remove.mutate(member.userId)} disabled={remove.isPending}>
                    <UserMinusIcon />
                  </Button>
                </>
              ) : (
                <Badge variant="outline" className="capitalize">{member.role}</Badge>
              )}
            </li>
          );
        })}
        {members.isPending && enabled && <li className="text-xs text-muted-foreground">Loading…</li>}
      </ul>

      {isOwner ? (
        <form onSubmit={submitInvite} className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="friend@example.com"
              aria-label="Invite by email"
              required
              disabled={invite.isPending}
            />
            <RolePicker label="Role for the invitation" value={role} onChange={setRole} disabled={invite.isPending} />
            <Button type="submit" variant="outline" disabled={invite.isPending || email.trim().length === 0}>
              Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">They need a Trove account with that email.</p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={leave} disabled={remove.isPending}>
          Leave this board
        </Button>
      )}
    </section>
  );
}
