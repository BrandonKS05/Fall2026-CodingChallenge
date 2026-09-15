import type {
  ConversationListQuery,
  MessagesQuery,
  SendMessageRequest,
  StartConversationRequest,
} from '@wumboo/shared';
import type { RequestHandler } from 'express';
import type { IdParams } from '../../http/params.js';
import { currentUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import type { MessagingService } from './MessagingService.js';
import {
  presentConversation,
  presentInbox,
  presentMessage,
  presentMessages,
} from './message.presenter.js';

export interface MessagingController {
  inbox: RequestHandler;
  accept: RequestHandler;
  start: RequestHandler;
  messages: RequestHandler;
  send: RequestHandler;
  markRead: RequestHandler;
}

export function createMessagingController(messaging: MessagingService): MessagingController {
  return {
    inbox: async (_req, res) => {
      const { query } = getValidated<unknown, ConversationListQuery>(res);
      res.json(presentInbox(await messaging.inbox(currentUser(res).id, query.box)));
    },

    accept: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      const summary = await messaging.accept(currentUser(res).id, params.id);
      res.json(presentConversation(summary));
    },

    start: async (_req, res) => {
      const { body } = getValidated<StartConversationRequest>(res);
      const summary = await messaging.startDirect(currentUser(res).id, body.handle);
      res.status(201).json(presentConversation(summary));
    },

    messages: async (_req, res) => {
      const { params, query } = getValidated<unknown, MessagesQuery, IdParams>(res);
      const page = await messaging.listMessages(currentUser(res).id, params.id, {
        limit: query.limit,
        before: query.before,
      });
      res.json(presentMessages(page));
    },

    send: async (_req, res) => {
      const { params, body } = getValidated<SendMessageRequest, unknown, IdParams>(res);
      const message = await messaging.send(currentUser(res).id, params.id, body.text);
      res.status(201).json(presentMessage(message));
    },

    markRead: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      await messaging.markRead(currentUser(res).id, params.id);
      res.status(204).end();
    },
  };
}
