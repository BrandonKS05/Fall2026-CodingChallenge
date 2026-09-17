import type {
  CreateItemRequest,
  SavedItemsQuery,
  UpdateItemRequest,
  UploadItemQuery,
} from '@wumboo/shared';
import type { RequestHandler } from 'express';
import { InvalidOperationError } from '../../domain/errors/index.js';
import type { ItemService } from './ItemService.js';
import type { CollectionItemParams, IdParams } from '../../http/params.js';
import { currentUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentItem, presentSavedItems } from './item.presenter.js';

export interface ItemsController {
  listMine: RequestHandler;
  add: RequestHandler;
  upload: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export function createItemsController(items: ItemService): ItemsController {
  return {
    listMine: async (_req, res) => {
      const { query } = getValidated<unknown, SavedItemsQuery>(res);
      res.json(presentSavedItems(await items.listMine(currentUser(res).id, query.limit)));
    },

    add: async (_req, res) => {
      const { params, body } = getValidated<CreateItemRequest, unknown, IdParams>(res);
      const detail = await items.add(params.id, currentUser(res).id, body);
      res.status(201).json(presentItem(detail));
    },

    upload: async (req, res) => {
      const { params, query } = getValidated<unknown, UploadItemQuery, IdParams>(res);
      // express.raw leaves a Buffer on the body, or an empty one for no body at all.
      const bytes = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array();
      if (bytes.byteLength === 0) throw new InvalidOperationError('No image was sent');
      const detail = await items.upload(params.id, currentUser(res).id, {
        bytes,
        caption: query.caption,
        tags: query.tags,
      });
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
