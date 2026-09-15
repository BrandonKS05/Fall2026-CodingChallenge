import {
  conversationListResponseSchema,
  handleFromSeed,
  messageListResponseSchema,
} from '@wumboo/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../testing/testApp.js';

async function signUp(app: Express, email: string): Promise<{ cookie: string; handle: string }> {
  const handle = handleFromSeed(email);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, handle, password: 'password-123', displayName: email.split('@')[0] });
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : [header ?? ''];
  return { cookie: cookies.find((cookie) => cookie.startsWith('wumboo_session=')) ?? '', handle };
}

describe('conversation routes', () => {
  let app: Express;
  let ada: { cookie: string; handle: string };
  let sam: { cookie: string; handle: string };

  beforeEach(async () => {
    app = buildTestApp();
    ada = await signUp(app, 'ada@example.com');
    sam = await signUp(app, 'sam@example.com');
  });

  const start = (as: { cookie: string }, handle: string) =>
    request(app).post('/api/conversations').set('Cookie', as.cookie).send({ handle });

  it('needs a session everywhere', async () => {
    expect((await request(app).get('/api/conversations')).status).toBe(401);
    expect((await request(app).post('/api/conversations').send({ handle: 'sam' })).status).toBe(
      401,
    );
  });

  it('starts a conversation by handle and matches the contract on both sides', async () => {
    const created = await start(ada, sam.handle);
    expect(created.status).toBe(201);
    expect(created.body.participants[0]).toMatchObject({ handle: sam.handle });

    const inbox = await request(app).get('/api/conversations').set('Cookie', sam.cookie);
    expect(conversationListResponseSchema.safeParse(inbox.body).success).toBe(true);
    expect(inbox.body.conversations[0].id).toBe(created.body.id);
    expect(inbox.body.unreadTotal).toBe(0);
  });

  it('sends, counts unread, and clears it on read', async () => {
    const conversation = (await start(ada, sam.handle)).body;

    const sent = await request(app)
      .post(`/api/conversations/${conversation.id}/messages`)
      .set('Cookie', ada.cookie)
      .send({ text: '  Hello there  ' });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ body: 'Hello there', sender: { handle: ada.handle } });

    const inbox = await request(app).get('/api/conversations').set('Cookie', sam.cookie);
    expect(inbox.body.unreadTotal).toBe(1);

    const page = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set('Cookie', sam.cookie);
    expect(messageListResponseSchema.safeParse(page.body).success).toBe(true);
    expect(page.body.messages).toHaveLength(1);
    expect(page.body.hasMore).toBe(false);

    const read = await request(app)
      .post(`/api/conversations/${conversation.id}/read`)
      .set('Cookie', sam.cookie);
    expect(read.status).toBe(204);
    expect(
      (await request(app).get('/api/conversations').set('Cookie', sam.cookie)).body.unreadTotal,
    ).toBe(0);
  });

  it('refuses an empty message, an unknown handle, yourself, and someone else’s conversation', async () => {
    const conversation = (await start(ada, sam.handle)).body;
    const outsider = await signUp(app, 'nosy@example.com');

    expect(
      (
        await request(app)
          .post(`/api/conversations/${conversation.id}/messages`)
          .set('Cookie', ada.cookie)
          .send({ text: '   ' })
      ).status,
    ).toBe(400);
    expect((await start(ada, 'nobodyhome')).status).toBe(404);
    expect((await start(ada, ada.handle)).status).toBe(400);
    expect(
      (
        await request(app)
          .get(`/api/conversations/${conversation.id}/messages`)
          .set('Cookie', outsider.cookie)
      ).status,
    ).toBe(403);
  });
});
