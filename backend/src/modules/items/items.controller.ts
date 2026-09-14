import type { CreateItemRequest, UpdateItemRequest } from '@trove/shared';
import type { RequestHandler } from 'express';
import type { ItemService } from './ItemService.js';
import type { CollectionItemParams, IdParams } from '../../http/params.js';
import { currentUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentItem } from './item.presenter.js';

export interface ItemsController {
  add: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export function createItemsController(items: ItemService): ItemsController {
  return {
    add: async (_req, res) => {
      const { params, body } = getValidated<CreateItemRequest, unknown, IdParams>(res);
      const detail = await items.add(params.id, currentUser(res).id, body);
      res.status(201).json(presentItem(detail));
    },

    update: async (_req, res) => {
      const { params, body } = getValidated<UpdateItemRequest, unknown, CollectionItemParams>(res);
      const detail = await items.update(params.id, params.itemId, currentUser(res).id, body);
      res.json(presentItem(detail));
    },

    remove: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, CollectionItemParams>(res);
      await items.remove(params.id, params.itemId, currentUser(res).id);
      res.status(204).end();
    },
  };
}
