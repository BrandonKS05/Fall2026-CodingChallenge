import { collectionDetailResponseSchema, memberSchema } from '@wumboo/shared';
import type { Express } from 'express';
import { handleFromSeed } from '@wumboo/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../testing/fakes/fakeAuth.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { buildTestApp } from '../../testing/testApp.js';

async function signUp(app: Express, email: string): Promise<{ cookie: string; id: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      handle: handleFromSeed(email),
      password: 'password-123',
      displayName: email.split('@')[0],
    });
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return {
    cookie: cookies.find((c) => c.startsWith('wumboo_session=')) ?? '',
    id: res.body.user.id,
  };
}

describe('sharing routes', () => {
  let app: Express;
  let owner: { cookie: string; id: string };
  let friend: { cookie: string; id: string };
  let boardId: string;

  beforeEach(async () => {
    app = buildTestApp({
      repositories: createFakeRepositories(),
      passwordHasher: new FakePasswordHasher(),
    });
    owner = await signUp(app, 'owner@example.com');
    friend = await signUp(app, 'friend@example.com');
    boardId = (
      await request(app)
        .post('/api/collections')
        .set('Cookie', owner.cookie)
        .send({ title: 'Board' })
    ).body.id;
  });

  it('creates, uses, and revokes a share link', async () => {
    expect((await request(app).post(`/api/collections/${boardId}/share-link`)).status).toBe(401);
    expect(
      (
        await request(app)
          .post(`/api/collections/${boardId}/share-link`)
          .set('Cookie', friend.cookie)
      ).status,
    ).toBe(403);

    const link = await request(app)
      .post(`/api/collections/${boardId}/share-link`)
      .set('Cookie', owner.cookie);
    expect(link.status).toBe(200);
    const { slug } = link.body;
    expect(slug).toMatch(/^[A-Za-z0-9_-]{11}$/);

    const shared = await request(app).get(`/api/shared/${slug}`);
    expect(shared.status).toBe(200);
    expect(collectionDetailResponseSchema.safeParse(shared.body).success).toBe(true);
    expect(shared.body.collection).toMatchObject({
      id: boardId,
      visibility: 'unlisted',
      role: null,
      shareSlug: slug,
    });

    const asOwner = await request(app).get(`/api/shared/${slug}`).set('Cookie', owner.cookie);
    expect(asOwner.body.collection.role).toBe('owner');

    expect(
      (
        await request(app)
          .delete(`/api/collections/${boardId}/share-link`)
          .set('Cookie', owner.cookie)
      ).status,
    ).toBe(204);
    expect((await request(app).get(`/api/shared/${slug}`)).status).toBe(404);
  });

  it('manages members through the contract', async () => {
    const membersUrl = `/api/collections/${boardId}/members`;
    const badRole = await request(app)
      .post(membersUrl)
      .set('Cookie', owner.cookie)
      .send({ email: 'friend@example.com', role: 'owner' });
    expect(badRole.status).toBe(400);

    const invited = await request(app)
      .post(membersUrl)
      .set('Cookie', owner.cookie)
      .send({ email: 'Friend@Example.com' });
    expect(invited.status).toBe(201);
    expect(memberSchema.safeParse(invited.body).success).toBe(true);
    expect(invited.body).toMatchObject({
      userId: friend.id,
      role: 'editor',
      displayName: 'friend',
    });

    const unknown = await request(app)
      .post(membersUrl)
      .set('Cookie', owner.cookie)
      .send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(404);

    const list = await request(app).get(membersUrl).set('Cookie', friend.cookie);
    expect(list.status).toBe(200);
    expect(list.body.members.map((m: { role: string }) => m.role)).toEqual(['owner', 'editor']);

    const demoted = await request(app)
      .patch(`${membersUrl}/${friend.id}`)
      .set('Cookie', owner.cookie)
      .send({ role: 'viewer' });
    expect(demoted.status).toBe(200);
    expect(demoted.body.role).toBe('viewer');
    expect(
      (
        await request(app)
          .patch(`${membersUrl}/${owner.id}`)
          .set('Cookie', owner.cookie)
          .send({ role: 'viewer' })
      ).status,
    ).toBe(400);

    expect(
      (await request(app).delete(`${membersUrl}/${friend.id}`).set('Cookie', friend.cookie)).status,
    ).toBe(204);
    expect((await request(app).get(membersUrl).set('Cookie', friend.cookie)).status).toBe(403);
  });
});
