/**
 * Items are images placed on a board. Every operation authorizes through
 * CollectionService first, then touches the board so lists reorder by activity.
 */
import type { CollectionItem, ItemDetail } from '../domain/entities/CollectionItem.js';
import type { ImageProviderName } from '../domain/entities/Image.js';
import { NotFoundError } from '../domain/errors/index.js';
import { createEvent } from '../domain/events/index.js';
import type { EventBus } from '../ports/EventBus.js';
import type { Logger } from '../ports/Logger.js';
import type { CollectionRepository } from '../ports/repositories/CollectionRepository.js';
import type { ItemPatch, ItemRepository } from '../ports/repositories/ItemRepository.js';
import type { CollectionService } from './CollectionService.js';
import type { ImageService } from './ImageService.js';

export interface ItemServiceDeps {
  items: ItemRepository;
  collectionRepository: CollectionRepository;
  collectionService: CollectionService;
  imageService: ImageService;
  events: EventBus;
  logger: Logger;
}

export interface AddItemInput {
  provider: ImageProviderName;
  providerImageId: string;
  caption: string;
  tags: string[];
}

export interface UpdateItemInput {
  caption?: string | undefined;
  tags?: string[] | undefined;
  position?: number | undefined;
  /** A different board id moves the item there. */
  collectionId?: string | undefined;
}

export class ItemService {
  private readonly log: Logger;

  constructor(private readonly deps: ItemServiceDeps) {
    this.log = deps.logger.child({ service: 'ItemService' });
  }

  async add(collectionId: string, actorId: string, input: AddItemInput): Promise<ItemDetail> {
    await this.deps.collectionService.authorize(collectionId, actorId, 'edit');
    const image = await this.deps.imageService.ensureStored(input.provider, input.providerImageId);
    const position = await this.deps.items.nextPosition(collectionId);
    const item = await this.deps.items.create({
      collectionId,
      imageId: image.id,
      addedById: actorId,
      caption: input.caption,
      tags: input.tags,
      position,
    });
    await this.deps.collectionRepository.touch(collectionId);
    this.log.info({ collectionId, itemId: item.id, actorId }, 'Item added');
    await this.deps.events.publish(
      createEvent('item.added', { collectionId, actorId, itemId: item.id, imageId: image.id }),
    );
    return this.detailOf(item.id);
  }

  async update(
    collectionId: string,
    itemId: string,
    actorId: string,
    input: UpdateItemInput,
  ): Promise<ItemDetail> {
    await this.deps.collectionService.authorize(collectionId, actorId, 'edit');
    await this.itemIn(collectionId, itemId);

    const target = input.collectionId;
    const moving = target !== undefined && target !== collectionId;
    const patch: ItemPatch = definedFields({
      caption: input.caption,
      tags: input.tags,
      position: input.position,
    });
    if (moving) {
      // Moving needs edit rights on the destination too; the item lands at the end of that board.
      await this.deps.collectionService.authorize(target, actorId, 'edit');
      patch.collectionId = target;
      patch.position ??= await this.deps.items.nextPosition(target);
    }

    const updated = await this.deps.items.update(itemId, patch);
    await this.deps.collectionRepository.touch(collectionId);
    if (moving) await this.deps.collectionRepository.touch(target);
    this.log.info({ collectionId, itemId, actorId, moved: moving }, 'Item updated');
    await this.deps.events.publish(
      createEvent('item.updated', { collectionId, actorId, itemId, moved: moving }),
    );
    return this.detailOf(updated.id);
  }

  async remove(collectionId: string, itemId: string, actorId: string): Promise<void> {
    await this.deps.collectionService.authorize(collectionId, actorId, 'edit');
    await this.itemIn(collectionId, itemId);
    await this.deps.items.delete(itemId);
    await this.deps.collectionRepository.touch(collectionId);
    this.log.info({ collectionId, itemId, actorId }, 'Item removed');
    await this.deps.events.publish(createEvent('item.removed', { collectionId, actorId, itemId }));
  }

  /** The item must exist and belong to the board in the URL, or it is a 404. */
  private async itemIn(collectionId: string, itemId: string): Promise<CollectionItem> {
    const item = await this.deps.items.findById(itemId);
    if (!item || item.collectionId !== collectionId) throw new NotFoundError('Item', itemId);
    return item;
  }

  private async detailOf(itemId: string): Promise<ItemDetail> {
    const detail = await this.deps.items.findDetail(itemId);
    if (!detail) throw new NotFoundError('Item', itemId);
    return detail;
  }
}

/** Drops undefined entries so an omitted field is never mistaken for "set to undefined". */
function definedFields<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
