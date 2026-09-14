import { pipeline } from 'node:stream/promises';
import type { RequestHandler } from 'express';
import type { ImageService } from '../../services/ImageService.js';
import type { IdParams } from '../http/params.js';
import { getValidated } from '../middleware/validate.js';

export interface ImagesController {
  serve: RequestHandler;
}

/** Streams stored files. Ids are immutable, so browsers may cache them for a year. */
export function createImagesController(images: ImageService): ImagesController {
  return {
    serve: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      const object = await images.open(params.id);

      res.status(200);
      res.setHeader('Content-Type', object.contentType);
      if (object.size > 0) res.setHeader('Content-Length', String(object.size));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      try {
        await pipeline(object.stream, res);
      } catch (error) {
        // The client went away mid-stream; there is nothing left to report to it.
        if (!res.headersSent) throw error;
        res.destroy();
      }
    },
  };
}
