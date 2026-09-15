/**
 * Board use cases. All authorization goes through `authorize`, which is also
 * used by the item and sharing services, so the access policy is enforced in
 * exactly one place.
 */
import type {
  Collection,
  CollectionSummary,
  PublicImage,
} from '../../domain/entities/Collection.js';
import type { ItemDetail } from '../../domain/entities/CollectionItem.js';
import type { CollectionRole } from '../../domain/entities/Membership.js';
import { ForbiddenError, NotFoundError } from '../../domain/errors/index.js';
import { createEvent } from '../../domain/events/index.js';
import { canEditItems, canManage, canView } from '../../domain/policies/collectionAccess.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { Logger } from '../../infrastructure/logging/Logger.js';
import type {
  CollectionPatch,
  CollectionRepository,
  NewCollection,
} from './ports/CollectionRepository.js';
import type { ItemRepository } from '../items/ports/ItemRepository.js';
import type { MembershipRepository } from './ports/MembershipRepository.js';

export interface CollectionServiceDeps {
  collections: CollectionRepository;
  memberships: MembershipRepository;
  items: ItemRepository;
  events: EventBus;
  logger: Logger;
}

export interface CollectionDetail {
  summary: CollectionSummary;
  items: ItemDetail[];
}

export type CreateCollectionInput = Omit<NewCollection, 'ownerId'>;

export interface Pagination {
  page: number;
  perPage: number;
}

/** What the caller needs to be allowed to do. */
export type AccessLevel = 'view' | 'edit' | 'manage';

export interface AuthorizedCollection {
  collection: Collection;
  role: CollectionRole | null;
}

export class CollectionService {
  private readonly log: Logger;

  constructor(private readonly deps: CollectionServiceDeps) {
    this.log = deps.logger.child({ service: 'CollectionService' });
  }

  listMine(userId: string): Promise<CollectionSummary[]> {
    return this.deps.collections.listForUser(userId);
  }

  listPublic(viewerId: string | null, { page, perPage }: Pagination): Promise<CollectionSummary[]> {
    return this.deps.collections.listPublic({
      limit: perPage,
      offset: (page - 1) * perPage,
      ...(viewerId !== null && { viewerId }),
    });
  }

  /** Landing-stage feed. Only public boards are read, so there is no viewer and no role. */
  listPublicImages(limit: number): Promise<PublicImage[]> {
    return this.deps.collections.listPublicImages({ limit });
  }

  async create(ownerId: string, input: CreateCollectionInput): Promise<CollectionSummary> {
    const collection = await this.deps.collections.create({ ...input, ownerId });
    this.log.info({ collectionId: collection.id, ownerId }, 'Collection created');
    return this.summaryOf(collection.id, ownerId);
  }

  async get(collectionId: string, viewerId: string | null): Promise<CollectionSummary> {
    const summary = await this.deps.collections.findSummary(collectionId, viewerId);
    if (!summary) throw new NotFoundError('Collection', collectionId);
    if (!canView(summary, summary.role)) throw new ForbiddenError('This board is private');
    return summary;
  }

  /** The board plus its items, for the board page and the shared-link page. */
  async getDetail(collectionId: string, viewerId: string | null): Promise<CollectionDetail> {
    const summary = await this.get(collectionId, viewerId);
    const items = await this.deps.items.listByCollection(collectionId);
    return { summary, items };
  }

  async update(
    collectionId: string,
    actorId: string,
    patch: CollectionPatch,
  ): Promise<CollectionSummary> {
    await this.authorize(collectionId, actorId, 'manage');
    await this.deps.collections.update(collectionId, patch);
    this.log.info({ collectionId, actorId }, 'Collection updated');
    await this.deps.events.publish(
      createEvent('collection.updated', { collectionId, actorId, changes: Object.keys(patch) }),
    );
    return this.summaryOf(collectionId, actorId);
  }

  async delete(collectionId: string, actorId: string): Promise<void> {
    await this.authorize(collectionId, actorId, 'manage');
    await this.deps.collections.delete(collectionId);
    this.log.info({ collectionId, actorId }, 'Collection deleted');
  }

  /**
   * Loads the board and the actor's role, then applies the access policy.
   * Throws NotFoundError for a missing board and ForbiddenError when the
   * actor lacks the requested level.
   */
  async authorize(
    collectionId: string,
    actorId: string | null,
    level: AccessLevel,
  ): Promise<AuthorizedCollection> {
    const collection = await this.deps.collections.findById(collectionId);
    if (!collection) throw new NotFoundError('Collection', collectionId);

    const membership =
      actorId === null ? null : await this.deps.memberships.find(collectionId, actorId);
    const role = membership?.role ?? null;

    const allowed = {
      view: canView(collection, role),
      edit: canEditItems(role),
      manage: canManage(role),
    }[level];
    if (!allowed) throw new ForbiddenError(forbiddenMessage(level));

    return { collection, role };
  }

  private async summaryOf(collectionId: string, viewerId: string): Promise<CollectionSummary> {
    const summary = await this.deps.collections.findSummary(collectionId, viewerId);
    if (!summary) throw new NotFoundError('Collection', collectionId);
    return summary;
  }
}

function forbiddenMessage(level: AccessLevel): string {
  switch (level) {
    case 'view':
      return 'This board is private';
    case 'edit':
      return 'Only editors and the owner can change items on this board';
    case 'manage':
      return 'Only the owner can change this board';
  }
}
