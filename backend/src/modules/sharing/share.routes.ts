import { inviteMemberRequestSchema, updateMemberRequestSchema } from '@wumboo/shared';
import { Router } from 'express';
import type { Container } from '../../container.js';
import { createShareController } from './share.controller.js';
import { idParams, memberParams, slugParams } from '../../http/params.js';
import { optionalAuth, requireAuth } from '../../http/middleware/authenticate.js';
import { validate } from '../../http/middleware/validate.js';

/** Share links and members. Mounted at /collections/:id with mergeParams so :id comes from the parent. */
export function createSharingRouter(container: Container): Router {
  const controller = createShareController(container.services.share);
  const signedIn = requireAuth({ tokens: container.tokens, users: container.repositories.users });

  const router = Router({ mergeParams: true });
  router.post('/share-link', signedIn, validate({ params: idParams }), controller.createLink);
  router.delete('/share-link', signedIn, validate({ params: idParams }), controller.revokeLink);
  router.get('/members', signedIn, validate({ params: idParams }), controller.listMembers);
  router.post(
    '/members',
    signedIn,
    validate({ params: idParams, body: inviteMemberRequestSchema }),
    controller.invite,
  );
  router.patch(
    '/members/:userId',
    signedIn,
    validate({ params: memberParams, body: updateMemberRequestSchema }),
    controller.updateRole,
  );
  router.delete(
    '/members/:userId',
    signedIn,
    validate({ params: memberParams }),
    controller.removeMember,
  );
  return router;
}

/** The public side of a share link. Mounted at /shared. */
export function createSharedRouter(container: Container): Router {
  const controller = createShareController(container.services.share);
  const maybeSignedIn = optionalAuth({
    tokens: container.tokens,
    users: container.repositories.users,
  });

  const router = Router();
  router.get('/:slug', maybeSignedIn, validate({ params: slugParams }), controller.openLink);
  return router;
}
