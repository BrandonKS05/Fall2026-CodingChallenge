import type { RecommendationsResponse } from '@wumboo/shared';
import { presentSavedItem } from '../items/item.presenter.js';
import type { Recommendations } from './RecommendationService.js';

export function presentRecommendations(feed: Recommendations): RecommendationsResponse {
  return {
    items: feed.items.map(presentSavedItem),
    cursor: feed.cursor,
    personalised: feed.personalised,
  };
}
