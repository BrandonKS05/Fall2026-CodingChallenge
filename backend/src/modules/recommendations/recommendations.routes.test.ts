import { recommendationsResponseSchema } from '@wumboo/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../testing/fakes/fakeAuth.js';
import type { InMemoryFeedRepository } from '../../testing/fakes/InMemoryFeedRepository.js';
import type { InMemoryInterestProfileRepository } from '../../testing/fakes/InMemoryInterestProfileRepository.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { signUpVia } from '../../testing/signUp.js';
import { buildTestApp } from '../../testing/testApp.js';

describe('recommendations routes', () => {
  let app: Express;
  let reader: string;
  let feed: InMemoryFeedRepository;
  let profiles: InMemoryInterestProfileRepository;

  beforeEach(async () => {
    const repositories = createFakeRepositories();
    feed = repositories.feed as InMemoryFeedRepository;
    profiles = repositories.interestProfiles as InMemoryInterestProfileRepository;
    app = buildTestApp({ repositories, passwordHasher: new FakePasswordHasher() });
    reader = (await signUpVia(app, 'reader@example.com')).cookie;

    // Six public pictures nobody has seen, each by a different person.
    feed.seed(6);
  });

  it('needs a session', async () => {
    expect((await request(app).get('/api/recommendations')).status).toBe(401);
    expect((await request(app).post('/api/recommendations/interactions').send({})).status).toBe(
      401,
    );
  });

  it('serves a feed that matches the contract, and pages without repeating', async () => {
    const first = await request(app)
      .get('/api/recommendations')
      .query({ limit: 3 })
      .set('Cookie', reader);

    expect(first.status).toBe(200);
    expect(recommendationsResponseSchema.safeParse(first.body).success).toBe(true);
    expect(first.body.items).toHaveLength(3);
    expect(first.body.cursor).toEqual(expect.any(String));

    const second = await request(app)
      .get('/api/recommendations')
      .query({ limit: 3, cursor: first.body.cursor })
      .set('Cookie', reader);

    const seen = first.body.items.map((item: { id: string }) => item.id);
    const next = second.body.items.map((item: { id: string }) => item.id);
    expect(next.some((id: string) => seen.includes(id))).toBe(false);
  });

  it('records what somebody did, and answers with nothing to wait for', async () => {
    const itemId = '11111111-1111-4111-8111-111111111111';
    profiles.setItemVector(itemId, [1, 0, 0]);

    const response = await request(app)
      .post('/api/recommendations/interactions')
      .set('Cookie', reader)
      .send({ itemId, type: 'like' });

    expect(response.status).toBe(204);
    expect(profiles.interactions).toHaveLength(1);
  });

  it('refuses an act it does not recognise, or one about nothing', async () => {
    const bad = (body: Record<string, unknown>) =>
      request(app).post('/api/recommendations/interactions').set('Cookie', reader).send(body);

    expect((await bad({ itemId: 'not-a-uuid', type: 'like' })).status).toBe(400);
    const unknownAct = await bad({ itemId: '11111111-1111-4111-8111-111111111111', type: 'shrug' });
    expect(unknownAct.status).toBe(400);
  });

  it('takes the categories somebody ticked, and takes a skip too', async () => {
    const answer = (categories: string[]) =>
      request(app)
        .post('/api/recommendations/interests')
        .set('Cookie', reader)
        .send({ categories });

    await answer(['nature', 'food']).expect(204);
    // Picking nothing is skipping, which is a real answer.
    await answer([]).expect(204);
    // Seven is more than anybody is asked for.
    const tooMany = await answer([
      'nature',
      'food',
      'animals',
      'music',
      'travel',
      'people',
      'sports',
    ]);
    expect(tooMany.status).toBe(400);
  });
});
