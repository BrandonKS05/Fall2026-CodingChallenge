/**
 * Everything the account holds, in one JSON document. Reads through the same
 * ports the rest of the app uses, so the export can never show more than the
 * person could already see, and stays correct as those repositories change.
 */
import type { CollectionRepository } from '../collections/ports/CollectionRepository.js';
import type { ItemService } from '../items/ItemService.js';
import type { UserRepository } from './ports/UserRepository.js';
import { AuthenticationError } from '../../domain/errors/index.js';

export interface AccountExportDeps {
  users: UserRepository;
  collections: CollectionRepository;
  items: ItemService;
}

/** Generous, because this is a person's whole history and it is read once. */
const SAVE_LIMIT = 5_000;

export class AccountExportService {
  constructor(private readonly deps: AccountExportDeps) {}

  async export(userId: string): Promise<Record<string, unknown>> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new AuthenticationError('Session user no longer exists');

    const [boards, saves] = await Promise.all([
      this.deps.collections.listForUser(userId),
      this.deps.items.listMine(userId, SAVE_LIMIT),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        handle: user.handle,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        joinedAt: user.createdAt.toISOString(),
        signsInWithGoogle: user.googleId !== null,
      },
      settings: user.preferences,
      boards: boards.map((board) => ({
        title: board.title,
        description: board.description,
        visibility: board.visibility,
        yourRole: board.role,
        images: board.itemCount,
        likes: board.likeCount,
        createdAt: board.createdAt.toISOString(),
        updatedAt: board.updatedAt.toISOString(),
      })),
      saves: saves.map((save) => ({
        board: save.collectionTitle,
        caption: save.caption,
        tags: save.tags,
        savedAt: save.createdAt.toISOString(),
        image: {
          source: save.image.sourceUrl,
          credit: save.image.credit,
          provider: save.image.provider,
          tags: save.image.tags,
        },
      })),
    };
  }
}
