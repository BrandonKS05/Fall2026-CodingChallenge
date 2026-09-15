import { collectionSchema } from '@trove/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePasswordHasher } from '../../testing/fakes/fakeAuth.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { buildTestApp } from '../../testing/testApp.js';

async function signUp(app: Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password-123', displayName: email.split('@')[0] });
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return cookies.find((cookie) => cookie.startsWith('trove_session=')) ?? '';
}

describe('collections routes', () => {
  let app: Express;
  let owner: string;
  let stranger: string;

  beforeEach(async () => {
    app = buildTestApp({
      repositories: createFakeRepositories(),
      passwordHasher: new FakePasswordHasher(),
    });
    owner = await signUp(app, 'owner@example.com');
    stranger = await signUp(app, 'stranger@example.com');
  });

  it('requires a session to list or create', async () => {
    expect((await request(app).get('/api/collections')).status).toBe(401);
    expect((await request(app).post('/api/collections').send({ title: 'x' })).status).toBe(401);
  });

  it('creates a board that matches the contract and appears in the list', async () => {
    const created = await request(app)
      .post('/api/collections')
      .set('Cookie', owner)
      .send({ title: '  Fall outfits ', description: 'Layers' });
    expect(created.status).toBe(201);
    expect(collectionSchema.safeParse(created.body).success).toBe(true);
    expect(created.body).toMatchObject({
      title: 'Fall outfits',
      visibility: 'private',
      role: 'owner',
      itemCount: 0,
      owner: { displayName: 'owner' },
    });

    const list = await request(app).get('/api/collections').set('Cookie', owner);
    expect(list.body.collections.map((c: { id: string }) => c.id)).toEqual([created.body.id]);
    const strangerList = await request(app).get('/api/collections').set('Cookie', stranger);
    expect(strangerList.body.collections).toEqual([]);
  });

  it('validates the create body', async () => {
    const res = await request(app)
      .post('/api/collections')
      .set('Cookie', owner)
      .send({ title: '', visibility: 'secret' });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['body.title', 'body.visibility']));
  });

  it('enforces visibility on GET and ownership on PATCH and DELETE', async () => {
    const { body: board } = await request(app)
      .post('/api/collections')
      .set('Cookie', owner)
      .send({ title: 'Private board' });

    expect((await request(app).get(`/api/collections/${board.id}`)).status).toBe(403);
    expect(
      (await request(app).get(`/api/collections/${board.id}`).set('Cookie', stranger)).status,
    ).toBe(403);

    const patchByStranger = await request(app)
      .patch(`/api/collections/${board.id}`)
      .set('Cookie', stranger)
      .send({ visibility: 'public' });
    expect(patchByStranger.status).toBe(403);

    const patched = await request(app)
      .patch(`/api/collections/${board.id}`)
      .set('Cookie', owner)
      .send({ visibility: 'public' });
    expect(patched.status).toBe(200);
    expect(patched.body.visibility).toBe('public');

    const anonymous = await request(app).get(`/api/collections/${board.id}`);
    expect(anonymous.status).toBe(200);
    expect(anonymous.body).toEqual({
      collection: expect.objectContaining({ id: board.id, role: null }),
      items: [],
    });

    const explore = await request(app).get('/api/explore?perPage=10');
    expect(explore.body.collections.map((c: { id: string }) => c.id)).toEqual([board.id]);

    expect(
      (await request(app).delete(`/api/collections/${board.id}`).set('Cookie', stranger)).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/collections/${board.id}`).set('Cookie', owner)).status,
    ).toBe(204);
    expect(
      (await request(app).get(`/api/collections/${board.id}`).set('Cookie', owner)).status,
    ).toBe(404);
  });

  it('rejects malformed ids and empty patches', async () => {
    expect(
      (await request(app).get('/api/collections/not-a-uuid').set('Cookie', owner)).status,
    ).toBe(400);
    const { body: board } = await request(app)
      .post('/api/collections')
      .set('Cookie', owner)
      .send({ title: 'x' });
    const empty = await request(app)
      .patch(`/api/collections/${board.id}`)
      .set('Cookie', owner)
      .send({});
    expect(empty.status).toBe(400);
  });
});
