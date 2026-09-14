import { idSchema } from '@trove/shared';
import { z } from 'zod';

/** Path params for routes shaped like /resource/:id. */
export const idParams = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParams>;

/** Path params for nested item routes: /collections/:id/items/:itemId. */
export const collectionItemParams = z.object({ id: idSchema, itemId: idSchema });
export type CollectionItemParams = z.infer<typeof collectionItemParams>;
