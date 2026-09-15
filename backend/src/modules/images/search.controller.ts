import type { SearchQuery } from '@wumboo/shared';
import type { RequestHandler } from 'express';
import type { ImageService } from './ImageService.js';
import { optionalUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentSearch } from './image.presenter.js';

export interface SearchController {
  search: RequestHandler;
}

export function createSearchController(images: ImageService): SearchController {
  return {
    search: async (_req, res) => {
      const { query } = getValidated<unknown, SearchQuery>(res);
      const result = await images.search(query, {
        mutedTags: optionalUser(res)?.preferences.mutedTags,
      });
      res.json(presentSearch(result));
    },
  };
}
