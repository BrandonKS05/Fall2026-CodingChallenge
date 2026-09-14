import { idSchema } from '@trove/shared';
import { z } from 'zod';

/** Path params for routes shaped like /resource/:id. */
export const idParams = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParams>;

/** Path params for nested item routes: /collections/:id/items/:itemId. */
export const collectionItemParams = z.object({ id: idSchema, itemId: idSchema });
export type CollectionItemParams = z.infer<typeof collectionItemParams>;

/** Path params for member routes: /collections/:id/members/:userId. */
export const memberParams = z.object({ id: idSchema, userId: idSchema });
export type MemberParams = z.infer<typeof memberParams>;

/** Path params for /shared/:slug. */
export const slugParams = z.object({ slug: z.string().min(1).max(64) });
export type SlugParams = z.infer<typeof slugParams>;
