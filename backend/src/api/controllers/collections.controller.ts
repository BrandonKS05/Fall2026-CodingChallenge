import type {
  CreateCollectionRequest,
  PaginationQuery,
  UpdateCollectionRequest,
} from '@trove/shared';
import type { RequestHandler } from 'express';
import type { CollectionService } from '../../services/CollectionService.js';
import type { IdParams } from '../http/params.js';
import { currentUser, optionalUser } from '../middleware/authenticate.js';
import { getValidated } from '../middleware/validate.js';
import {
  presentCollection,
  presentCollectionDetail,
  presentCollectionList,
} from '../presenters/collection.presenter.js';

export interface CollectionsController {
  list: RequestHandler;
  explore: RequestHandler;
  create: RequestHandler;
  get: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
}

export function createCollectionsController(service: CollectionService): CollectionsController {
  return {
    list: async (_req, res) => {
      const summaries = await service.listMine(currentUser(res).id);
      res.json(presentCollectionList(summaries));
    },

    explore: async (_req, res) => {
      const { query } = getValidated<unknown, PaginationQuery>(res);
      const summaries = await service.listPublic(optionalUser(res)?.id ?? null, query);
      res.json(presentCollectionList(summaries));
    },

    create: async (_req, res) => {
      const { body } = getValidated<CreateCollectionRequest>(res);
      const summary = await service.create(currentUser(res).id, body);
      res.status(201).json(presentCollection(summary));
    },

    get: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      const summary = await service.get(params.id, optionalUser(res)?.id ?? null);
      res.json(presentCollectionDetail(summary));
    },

    update: async (_req, res) => {
      const { params, body } = getValidated<UpdateCollectionRequest, unknown, IdParams>(res);
      const summary = await service.update(params.id, currentUser(res).id, body);
      res.json(presentCollection(summary));
    },

    remove: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      await service.delete(params.id, currentUser(res).id);
      res.status(204).end();
    },
  };
}
