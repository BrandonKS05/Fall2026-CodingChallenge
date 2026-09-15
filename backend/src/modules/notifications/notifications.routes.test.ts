import { notificationListResponseSchema } from '@trove/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../testing/fakes/fakeAuth.js';
import { createFakeFetch, FAKE_JPEG } from '../../testing/fakes/fakeFetch.js';
import { FakeImageProvider, fakeProviderImage } from '../../testing/fakes/FakeImageProvider.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { buildTestApp } from '../../testing/testApp.js';

async function signUp(app: Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password-123', displayName: email.split('@')[0] });
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return cookies.find((c) => c.startsWith('trove_session=')) ?? '';
}

describe('notifications routes', () => {
  let app: Express;
  let owner: string;
  let friend: string;
  let boardId: string;

  beforeEach(async () => {
    app = buildTestApp({
      repositories: createFakeRepositories(),
      passwordHasher: new FakePasswordHasher(),
      imageProvider: new FakeImageProvider([fakeProviderImage('101')]),
      fetchFn: createFakeFetch({
        'https://fake.test/download/101.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
      }),
    });
    owner = await signUp(app, 'owner@example.com');
    friend = await signUp(app, 'friend@example.com');
    boardId = (
      await request(app).post('/api/collections').set('Cookie', owner).send({ title: 'Kitchens' })
    ).body.id;
    await request(app)
      .post(`/api/collections/${boardId}/members`)
      .set('Cookie', owner)
      .send({ email: 'friend@example.com' });
  });

  it("tells members about each other's activity and lets them clear the badge", async () => {
    const friendInbox = await request(app).get('/api/notifications').set('Cookie', friend);
    expect(friendInbox.status).toBe(200);
    expect(notificationListResponseSchema.safeParse(friendInbox.body).success).toBe(true);
    expect(friendInbox.body.unreadCount).toBe(1);
    expect(friendInbox.body.notifications[0]).toMatchObject({
      type: 'member_added',
      actor: { displayName: 'owner' },
      collection: { title: 'Kitchens' },
    });

    await request(app)
      .post(`/api/collections/${boardId}/items`)
      .set('Cookie', friend)
      .send({ provider: 'pixabay', providerImageId: '101' });

    const ownerInbox = await request(app).get('/api/notifications').set('Cookie', owner);
    expect(ownerInbox.body.unreadCount).toBe(1);
    expect(ownerInbox.body.notifications[0]).toMatchObject({
      type: 'item_added',
      actor: { displayName: 'friend' },
    });
    expect(ownerInbox.body.notifications[0].payload.imageId).toMatch(/[0-9a-f-]{36}/);

    expect(
      (
        await request(app)
          .post('/api/notifications/read')
          .set('Cookie', owner)
          .send({ ids: ['nope'] })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/notifications/read').set('Cookie', owner).send({})).status,
    ).toBe(204);
    expect(
      (await request(app).get('/api/notifications').set('Cookie', owner)).body.unreadCount,
    ).toBe(0);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});
