import { itemSchema } from '@trove/shared';
import type { Express } from 'express';
import request, { type Response } from 'supertest';
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
  return cookies.find((cookie) => cookie.startsWith('trove_session=')) ?? '';
}

describe('items routes', () => {
  let app: Express;
  let owner: string;
  let stranger: string;
  let boardId: string;

  const saveBody = { provider: 'pixabay', providerImageId: '101', caption: 'Nice one' };

  beforeEach(async () => {
    app = buildTestApp({
      repositories: createFakeRepositories(),
      passwordHasher: new FakePasswordHasher(),
      imageProvider: new FakeImageProvider([fakeProviderImage('101'), fakeProviderImage('102')]),
      fetchFn: createFakeFetch({
        'https://fake.test/download/101.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
        'https://fake.test/download/102.jpg': { contentType: 'image/jpeg', body: FAKE_JPEG },
      }),
    });
    owner = await signUp(app, 'owner@example.com');
    stranger = await signUp(app, 'stranger@example.com');
    boardId = (await request(app).post('/api/collections').set('Cookie', owner).send({ title: 'Board' })).body.id;
  });

  it('saves an image, shows it on the board, and serves the stored file', async () => {
    const created = await request(app).post(`/api/collections/${boardId}/items`).set('Cookie', owner).send(saveBody);
    expect(created.status).toBe(201);
    expect(itemSchema.safeParse(created.body).success).toBe(true);
    expect(created.body).toMatchObject({ caption: 'Nice one', position: 0, addedBy: { displayName: 'owner' } });
    expect(created.body.image.url).toMatch(/^\/api\/images\/[0-9a-f-]{36}$/);

    const detail = await request(app).get(`/api/collections/${boardId}`).set('Cookie', owner);
    expect(detail.body.items).toHaveLength(1);
    expect(detail.body.collection).toMatchObject({ itemCount: 1, previewImageIds: [created.body.image.id] });

    const file = await request(app).get(created.body.image.url).buffer(true).parse(binaryParser);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/jpeg');
    expect(file.headers['cache-control']).toContain('immutable');
    expect(new Uint8Array(file.body as Buffer)).toEqual(FAKE_JPEG);
  });

  it('enforces auth, roles, duplicates, unknown images, and validation', async () => {
    const url = `/api/collections/${boardId}/items`;
    expect((await request(app).post(url).send(saveBody)).status).toBe(401);
    expect((await request(app).post(url).set('Cookie', stranger).send(saveBody)).status).toBe(403);
    expect((await request(app).post(url).set('Cookie', owner).send({ provider: 'pixabay' })).status).toBe(400);
    expect((await request(app).post(url).set('Cookie', owner).send({ ...saveBody, providerImageId: '999' })).status).toBe(404);

    expect((await request(app).post(url).set('Cookie', owner).send(saveBody)).status).toBe(201);
    const duplicate = await request(app).post(url).set('Cookie', owner).send(saveBody);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('edits, moves, and removes items', async () => {
    const item = (await request(app).post(`/api/collections/${boardId}/items`).set('Cookie', owner).send(saveBody)).body;
    const itemUrl = `/api/collections/${boardId}/items/${item.id}`;

    const patched = await request(app).patch(itemUrl).set('Cookie', owner).send({ caption: 'Renamed', tags: ['wood', 'warm'] });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ caption: 'Renamed', tags: ['wood', 'warm'] });
    expect((await request(app).patch(itemUrl).set('Cookie', owner).send({})).status).toBe(400);

    const other = (await request(app).post('/api/collections').set('Cookie', owner).send({ title: 'Other' })).body;
    const moved = await request(app).patch(itemUrl).set('Cookie', owner).send({ collectionId: other.id });
    expect(moved.status).toBe(200);
    expect(moved.body.collectionId).toBe(other.id);
    expect((await request(app).delete(itemUrl).set('Cookie', owner)).status).toBe(404);

    const movedUrl = `/api/collections/${other.id}/items/${item.id}`;
    expect((await request(app).delete(movedUrl).set('Cookie', stranger)).status).toBe(403);
    expect((await request(app).delete(movedUrl).set('Cookie', owner)).status).toBe(204);
    expect((await request(app).get(`/api/collections/${other.id}`).set('Cookie', owner)).body.items).toEqual([]);
  });
});

function binaryParser(res: Response, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
