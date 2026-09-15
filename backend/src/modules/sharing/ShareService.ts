/**
 * Two ways to share a board: a link anyone can open, and memberships that
 * let specific accounts collaborate. Every operation authorizes through
 * CollectionService first.
 */
import { randomBytes } from 'node:crypto';
import type { Collection } from '../../domain/entities/Collection.js';
import type { CollectionRole, MemberDetail, Membership } from '../../domain/entities/Membership.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidOperationError,
  NotFoundError,
} from '../../domain/errors/index.js';
import { createEvent } from '../../domain/events/index.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type { CollectionRepository } from '../collections/ports/CollectionRepository.js';
import type { MembershipRepository } from '../collections/ports/MembershipRepository.js';
import type { UserRepository } from '../auth/ports/UserRepository.js';
import type { CollectionDetail, CollectionService } from '../collections/CollectionService.js';

export interface ShareServiceDeps {
  collections: CollectionRepository;
  memberships: MembershipRepository;
  users: UserRepository;
  collectionService: CollectionService;
  events: EventBus;
  logger: Logger;
}

const SLUG_ATTEMPTS = 3;

export class ShareService {
  private readonly log: Logger;

  constructor(private readonly deps: ShareServiceDeps) {
    this.log = deps.logger.child({ service: 'ShareService' });
  }

  /**
   * Returns the board's share slug, creating one if needed. A private board
   * becomes unlisted so the link actually works; public boards are untouched.
   */
  async createLink(collectionId: string, actorId: string): Promise<string> {
    const { collection } = await this.deps.collectionService.authorize(
      collectionId,
      actorId,
      'manage',
    );
    if (collection.shareSlug) return collection.shareSlug;

    if (collection.visibility === 'private') {
      await this.deps.collections.update(collectionId, { visibility: 'unlisted' });
    }
    const updated = await this.assignFreshSlug(collectionId);
    this.log.info({ collectionId, actorId }, 'Share link created');
    return updated.shareSlug ?? '';
  }

  /** Removes the link. An unlisted board goes back to private; a public one stays public. */
  async revokeLink(collectionId: string, actorId: string): Promise<void> {
    const { collection } = await this.deps.collectionService.authorize(
      collectionId,
      actorId,
      'manage',
    );
    await this.deps.collections.setShareSlug(collectionId, null);
    if (collection.visibility === 'unlisted') {
      await this.deps.collections.update(collectionId, { visibility: 'private' });
    }
    this.log.info({ collectionId, actorId }, 'Share link revoked');
  }

  /** The board behind a share link, with the viewer's own role if they are a member. */
  async openLink(slug: string, viewerId: string | null): Promise<CollectionDetail> {
    const collection = await this.deps.collections.findByShareSlug(slug);
    if (!collection) throw new NotFoundError('Shared board');
    return this.deps.collectionService.getDetail(collection.id, viewerId);
  }

  /** Members see each other; visitors to a public board do not get the member list. */
  async listMembers(collectionId: string, actorId: string): Promise<MemberDetail[]> {
    const { role } = await this.deps.collectionService.authorize(collectionId, actorId, 'view');
    if (role === null) throw new ForbiddenError('Only members can see who is on this board');
    return this.deps.memberships.listByCollection(collectionId);
  }

  async invite(
    collectionId: string,
    actorId: string,
    email: string,
    role: Exclude<CollectionRole, 'owner'>,
  ): Promise<MemberDetail> {
    await this.deps.collectionService.authorize(collectionId, actorId, 'manage');
    const user = await this.deps.users.findByEmail(email);
    if (!user) throw new NotFoundError('No account with that email');

    const membership = await this.deps.memberships.add({ collectionId, userId: user.id, role });
    this.log.info({ collectionId, actorId, userId: user.id, role }, 'Member invited');
    await this.deps.events.publish(
      createEvent('member.added', { collectionId, actorId, userId: user.id, role }),
    );
    return this.detailOf(membership);
  }

  async updateRole(
    collectionId: string,
    actorId: string,
    userId: string,
    role: Exclude<CollectionRole, 'owner'>,
  ): Promise<MemberDetail> {
    const { collection } = await this.deps.collectionService.authorize(
      collectionId,
      actorId,
      'manage',
    );
    if (userId === collection.ownerId)
      throw new InvalidOperationError("The owner's role cannot change");
    const membership = await this.deps.memberships.updateRole(collectionId, userId, role);
    this.log.info({ collectionId, actorId, userId, role }, 'Member role changed');
    return this.detailOf(membership);
  }

  /** Owners remove anyone; members may remove themselves (leave). The owner cannot be removed. */
  async removeMember(collectionId: string, actorId: string, userId: string): Promise<void> {
    const leaving = actorId === userId;
    const { collection } = await this.deps.collectionService.authorize(
      collectionId,
      actorId,
      leaving ? 'view' : 'manage',
    );
    if (userId === collection.ownerId)
      throw new InvalidOperationError('The owner cannot be removed');
    if (!(await this.deps.memberships.find(collectionId, userId)))
      throw new NotFoundError('Membership');
    await this.deps.memberships.remove(collectionId, userId);
    this.log.info({ collectionId, actorId, userId }, leaving ? 'Member left' : 'Member removed');
  }

  private async assignFreshSlug(collectionId: string): Promise<Collection> {
    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
      try {
        return await this.deps.collections.setShareSlug(collectionId, generateSlug());
      } catch (error) {
        if (!(error instanceof ConflictError) || attempt === SLUG_ATTEMPTS) throw error;
      }
    }
    throw new ConflictError('Could not allocate a share link');
  }

  private async detailOf(membership: Membership): Promise<MemberDetail> {
    const user = await this.deps.users.findById(membership.userId);
    if (!user) throw new NotFoundError('User', membership.userId);
    return {
      ...membership,
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
    };
  }
}

/** 64 bits of randomness, URL-safe, 11 characters. */
function generateSlug(): string {
  return randomBytes(8).toString('base64url');
}
