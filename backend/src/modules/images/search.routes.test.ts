import { searchResponseSchema } from '@wumboo/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FakeImageProvider, fakeProviderImage } from '../../testing/fakes/FakeImageProvider.js';
import { buildTestApp } from '../../testing/testApp.js';

describe('GET /api/search', () => {
  const app = buildTestApp({
    imageProvider: new FakeImageProvider([
      fakeProviderImage('1'),
      fakeProviderImage('2'),
      fakeProviderImage('3', { tags: ['dogs'] }),
    ]),
  });

  it('returns provider-agnostic results matching the contract without requiring a session', async () => {
    const res = await request(app).get('/api/search?q=kitchen&perPage=1&page=2');
    expect(res.status).toBe(200);
    expect(searchResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body).toMatchObject({ page: 2, perPage: 1, total: 2 });
    expect(res.body.results.map((r: { providerImageId: string }) => r.providerImageId)).toEqual([
      '2',
    ]);
    expect(res.body.results[0].credit).toEqual({
      name: 'photographer',
      profileUrl: 'https://fake.test/users/photographer',
    });
  });

  it('validates the query', async () => {
    expect((await request(app).get('/api/search')).status).toBe(400);
    expect((await request(app).get('/api/search?q=kitchen&perPage=500')).status).toBe(400);
    expect((await request(app).get('/api/search?q=kitchen&color=neon')).status).toBe(400);
  });
});
