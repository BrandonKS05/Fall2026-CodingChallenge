import { followListResponseSchema, profileResponseSchema } from '@wumboo/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { signUpVia } from '../../testing/signUp.js';
import { buildTestApp } from '../../testing/testApp.js';

async function signUp(app: Express, email: string): Promise<{ cookie: string; handle: string }> {
  const { cookie, handle } = await signUpVia(app, email);
  return { cookie, handle };
}

describe('user routes', () => {
  let app: Express;
  let ada: { cookie: string; handle: string };
  let sam: { cookie: string; handle: string };

  beforeEach(async () => {
    app = buildTestApp();
    ada = await signUp(app, 'ada@example.com');
    sam = await signUp(app, 'sam@example.com');
  });

  it('serves a profile to anyone, in the shape the contract promises', async () => {
    const res = await request(app).get(`/api/users/${ada.handle}`);

    expect(res.status).toBe(200);
    expect(profileResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.profile).toMatchObject({
      handle: 'ada',
      followerCount: 0,
      followedByViewer: false,
      isViewer: false,
    });
    expect((await request(app).get('/api/users/nobodyhome')).status).toBe(404);
    // A handle is normalized on the way in, so the link is forgiving.
    expect((await request(app).get('/api/users/ADA')).status).toBe(200);
  });

  it('finds people by handle or by the name they show, handles first', async () => {
    const res = await request(app).get('/api/users/search?q=ad');

    expect(res.status).toBe(200);
    expect(followListResponseSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.profiles.map((profile: { handle: string }) => profile.handle)).toEqual(['ada']);

    // The @ people write before a handle is not part of it.
    expect((await request(app).get('/api/users/search?q=%40ada')).body.profiles).toHaveLength(1);
    // And the display name is searchable too, so a name you half remember still lands.
    expect((await request(app).get('/api/users/search?q=sam')).body.profiles).toHaveLength(1);
    expect((await request(app).get('/api/users/search?q=nobody')).body.profiles).toEqual([]);
    // Nothing to search by is a bad request, not an empty page of everyone.
    expect((await request(app).get('/api/users/search?q=')).status).toBe(400);
    // The catch-all route must not swallow it.
    expect((await request(app).get('/api/users/search?q=ada')).body.profiles[0].handle).toBe('ada');
  });

  it('leaves you out of your own search', async () => {
    const mine = await request(app).get('/api/users/search?q=ada').set('Cookie', ada.cookie);
    expect(mine.body.profiles).toEqual([]);
    // Signed out there is no self to leave out.
    expect((await request(app).get('/api/users/search?q=ada')).body.profiles).toHaveLength(1);
  });

  it('says whether the viewer already follows the people it finds', async () => {
    await request(app).post(`/api/users/${ada.handle}/follow`).set('Cookie', sam.cookie);

    const asSam = await request(app).get('/api/users/search?q=ada').set('Cookie', sam.cookie);
    expect(asSam.body.profiles[0]).toMatchObject({ handle: 'ada', followedByViewer: true });
    const asVisitor = await request(app).get('/api/users/search?q=ada');
    expect(asVisitor.body.profiles[0]).toMatchObject({ followedByViewer: false });
  });

  it('follows and unfollows, answering with the profile both times', async () => {
    const followed = await request(app)
      .post(`/api/users/${ada.handle}/follow`)
      .set('Cookie', sam.cookie);
    expect(followed.status).toBe(200);
    expect(followed.body.profile).toMatchObject({ followerCount: 1, followedByViewer: true });

    const dropped = await request(app)
      .delete(`/api/users/${ada.handle}/follow`)
      .set('Cookie', sam.cookie);
    expect(dropped.body.profile).toMatchObject({ followerCount: 0, followedByViewer: false });
  });

  it('needs a session to follow, and refuses your own handle', async () => {
    expect((await request(app).post(`/api/users/${ada.handle}/follow`)).status).toBe(401);
    expect(
      (await request(app).post(`/api/users/${ada.handle}/follow`).set('Cookie', ada.cookie)).status,
    ).toBe(400);
  });

  it('lists followers and following for anyone to read', async () => {
    await request(app).post(`/api/users/${ada.handle}/follow`).set('Cookie', sam.cookie);

    const followers = await request(app).get(`/api/users/${ada.handle}/followers`);
    expect(followListResponseSchema.safeParse(followers.body).success).toBe(true);
    expect(followers.body.profiles.map((p: { handle: string }) => p.handle)).toEqual(['sam']);
    expect(followers.body.profiles[0].followedByViewer).toBe(false);

    const asSam = await request(app)
      .get(`/api/users/${sam.handle}/following`)
      .set('Cookie', sam.cookie);
    expect(asSam.body.profiles.map((p: { handle: string }) => p.handle)).toEqual(['ada']);
    expect((await request(app).get(`/api/users/${ada.handle}/followers?limit=0`)).status).toBe(400);
  });
});
