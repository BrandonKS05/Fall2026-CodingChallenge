import type {
  ChooseInterestsRequest,
  RecommendationsQuery,
  RecordInteractionRequest,
} from '@wumboo/shared';
import type { RequestHandler } from 'express';
import { currentUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import type { InterestProfileService } from './InterestProfileService.js';
import type { RecommendationService } from './RecommendationService.js';
import { presentRecommendations } from './recommendations.presenter.js';

export interface RecommendationsController {
  feed: RequestHandler;
  record: RequestHandler;
  chooseInterests: RequestHandler;
}

export function createRecommendationsController(
  recommendations: RecommendationService,
  interests: InterestProfileService,
): RecommendationsController {
  return {
    feed: async (_req, res) => {
      const { query } = getValidated<unknown, RecommendationsQuery>(res);
      const feed = await recommendations.getRecommendations(
        currentUser(res).id,
        query.limit,
        query.cursor,
      );
      res.json(presentRecommendations(feed));
    },

    /**
     * Nothing comes back. Telling the server what you looked at should never
     * be something the interface has to wait on.
     */
    record: async (_req, res) => {
      const { body } = getValidated<RecordInteractionRequest>(res);
      await interests.recordInteraction({
        userId: currentUser(res).id,
        itemId: body.itemId,
        type: body.type,
        dwellMs: body.dwellMs,
      });
      res.status(204).end();
    },

    chooseInterests: async (_req, res) => {
      const { body } = getValidated<ChooseInterestsRequest>(res);
      await interests.seedFromCategories(currentUser(res).id, body.categories);
      res.status(204).end();
    },
  };
}
