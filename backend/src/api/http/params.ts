import { idSchema } from '@trove/shared';
import { z } from 'zod';

/** Path params for routes shaped like /resource/:id. */
export const idParams = z.object({ id: idSchema });
export type IdParams = z.infer<typeof idParams>;
