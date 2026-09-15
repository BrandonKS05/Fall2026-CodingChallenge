import type { InviteMemberRequest, UpdateMemberRequest } from '@wumboo/shared';
import type { RequestHandler } from 'express';
import type { ShareService } from './ShareService.js';
import type { IdParams, MemberParams, SlugParams } from '../../http/params.js';
import { currentUser, optionalUser } from '../../http/middleware/authenticate.js';
import { getValidated } from '../../http/middleware/validate.js';
import { presentCollectionDetail } from '../collections/collection.presenter.js';
import { presentMember, presentMemberList } from './member.presenter.js';

export interface ShareController {
  createLink: RequestHandler;
  revokeLink: RequestHandler;
  openLink: RequestHandler;
  listMembers: RequestHandler;
  invite: RequestHandler;
  updateRole: RequestHandler;
  removeMember: RequestHandler;
}

export function createShareController(share: ShareService): ShareController {
  return {
    createLink: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      const slug = await share.createLink(params.id, currentUser(res).id);
      res.json({ slug });
    },

    revokeLink: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      await share.revokeLink(params.id, currentUser(res).id);
      res.status(204).end();
    },

    openLink: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, SlugParams>(res);
      const { summary, items } = await share.openLink(params.slug, optionalUser(res)?.id ?? null);
      res.json(presentCollectionDetail(summary, items));
    },

    listMembers: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, IdParams>(res);
      res.json(presentMemberList(await share.listMembers(params.id, currentUser(res).id)));
    },

    invite: async (_req, res) => {
      const { params, body } = getValidated<InviteMemberRequest, unknown, IdParams>(res);
      const member = await share.invite(params.id, currentUser(res).id, body.email, body.role);
      res.status(201).json(presentMember(member));
    },

    updateRole: async (_req, res) => {
      const { params, body } = getValidated<UpdateMemberRequest, unknown, MemberParams>(res);
      const member = await share.updateRole(
        params.id,
        currentUser(res).id,
        params.userId,
        body.role,
      );
      res.json(presentMember(member));
    },

    removeMember: async (_req, res) => {
      const { params } = getValidated<unknown, unknown, MemberParams>(res);
      await share.removeMember(params.id, currentUser(res).id, params.userId);
      res.status(204).end();
    },
  };
}
