import type { FollowListQuery, HandleParams, ProfileSearchQuery } from '@wumboo/shared';
import type { RequestHandler } from 'express';
import { currentUser, optionalUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentFollowList, presentProfile } from './profile.presenter.js';
import type { SocialService } from './SocialService.js';

export interface SocialController {
  search: RequestHandler;
  profile: RequestHandler;
  follow: RequestHandler;
  unfollow: RequestHandler;
  followers: RequestHandler;
  following: RequestHandler;
}

export function createSocialController(social: SocialService): SocialController {
  return {
    search: async (_req, res) => {
      const { query } = getValidated<unknown, ProfileSearchQuery>(res);
      const viewerId = optionalUser(res)?.id ?? null;
      res.json(presentFollowList(await social.searchPeople(query.q, viewerId, query.limit)));
    },

    profile: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, HandleParams>(res);
      const viewerId = optionalUser(res)?.id ?? null;
      res.json(presentProfile(await social.profile(params.handle, viewerId)));
    },

    follow: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, HandleParams>(res);
      res.json(presentProfile(await social.follow(currentUser(res).id, params.handle)));
    },

    unfollow: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, HandleParams>(res);
      res.json(presentProfile(await social.unfollow(currentUser(res).id, params.handle)));
    },

    followers: async (_req, res) => {
      const { params, query } = getValidated<unknown, FollowListQuery, HandleParams>(res);
      const viewerId = optionalUser(res)?.id ?? null;
      res.json(presentFollowList(await social.followers(params.handle, viewerId, query.limit)));
    },

    following: async (_req, res) => {
      const { params, query } = getValidated<unknown, FollowListQuery, HandleParams>(res);
      const viewerId = optionalUser(res)?.id ?? null;
      res.json(presentFollowList(await social.following(params.handle, viewerId, query.limit)));
    },
  };
}
