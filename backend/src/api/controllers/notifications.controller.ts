import type { MarkNotificationsReadRequest } from '@trove/shared';
import type { RequestHandler } from 'express';
import type { NotificationService } from '../../services/NotificationService.js';
import { currentUser } from '../middleware/authenticate.js';
import { getValidated } from '../middleware/validate.js';
import { presentInbox } from '../presenters/notification.presenter.js';

export interface NotificationsController {
  inbox: RequestHandler;
  markRead: RequestHandler;
}

export function createNotificationsController(service: NotificationService): NotificationsController {
  return {
    inbox: async (_req, res) => {
      res.json(presentInbox(await service.inbox(currentUser(res).id)));
    },

    markRead: async (_req, res) => {
      const { body } = getValidated<MarkNotificationsReadRequest>(res);
      await service.markRead(currentUser(res).id, body.ids);
      res.status(204).end();
    },
  };
}
