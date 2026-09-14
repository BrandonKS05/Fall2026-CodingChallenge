import type { SearchQuery } from '@trove/shared';
import type { RequestHandler } from 'express';
import type { ImageService } from '../../services/ImageService.js';
import { getValidated } from '../middleware/validate.js';
import { presentSearch } from '../presenters/image.presenter.js';

export interface SearchController {
  search: RequestHandler;
}

export function createSearchController(images: ImageService): SearchController {
  return {
    search: async (_req, res) => {
      const { query } = getValidated<unknown, SearchQuery>(res);
      const result = await images.search(query);
      res.json(presentSearch(result));
    },
  };
}
