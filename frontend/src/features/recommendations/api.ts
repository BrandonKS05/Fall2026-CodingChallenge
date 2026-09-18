import type {
  ChooseInterestsRequest,
  RecommendationsResponse,
  RecordInteractionRequest,
} from '@wumboo/shared';
import { http } from '@/lib/api';

/** The feature's slice of the API contract, so components never see a URL. */
export const recommendationsApi = {
  feed: (query: { limit: number; cursor?: string | undefined }) =>
    http.get<RecommendationsResponse>('/recommendations', { query }),
  record: (body: RecordInteractionRequest) =>
    http.post<void>('/recommendations/interactions', body),
  chooseInterests: (body: ChooseInterestsRequest) =>
    http.post<void>('/recommendations/interests', body),
};
