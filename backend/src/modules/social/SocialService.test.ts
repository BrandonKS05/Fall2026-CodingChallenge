import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidOperationError, NotFoundError } from '../../domain/errors/index.js';
import { silentLogger } from '../../testing/fakes/fakeAuth.js';
import { createFakeRepositories } from '../../testing/fakeRepositories.js';
import { SocialService } from './SocialService.js';

describe('SocialService', () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let service: SocialService;
  let ada: string;
  let sam: string;
  let grace: string;

  beforeEach(async () => {
    repos = createFakeRepositories();
    service = new SocialService({
      users: repos.users,
      follows: repos.follows,
      collections: repos.collections,
      logger: silentLogger,
    });

    const user = (handle: string) =>
      repos.users.create({
        email: `${handle}@x.com`,
        handle,
        displayName: handle,
        passwordHash: 'h',
      });
    ada = (await user('ada')).id;
    sam = (await user('sam')).id;
    grace = (await user('grace')).id;
  });

  it('shows a profile to a visitor, with counts and nothing followed', async () => {
    const { profile, boards } = await service.profile('ada', null);

    expect(profile).toMatchObject({
      handle: 'ada',
      followerCount: 0,
      followingCount: 0,
      boardCount: 0,
      followedByViewer: false,
      isViewer: false,
    });
    expect(boards).toEqual([]);
    await expect(service.profile('nobody', null)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('follows once however many times it is asked, and both counts move', async () => {
    await service.follow(sam, 'ada');
    const again = await service.follow(sam, 'ada');

    expect(again.profile).toMatchObject({ followerCount: 1, followedByViewer: true });
    expect((await service.profile('sam', sam)).profile).toMatchObject({
      followingCount: 1,
      isViewer: true,
    });
    // Following is one-way until the other person follows back.
    expect((await service.profile('sam', ada)).profile.followedByViewer).toBe(false);
  });

  it('refuses to follow yourself or someone who does not exist', async () => {
    await expect(service.follow(ada, 'ada')).rejects.toBeInstanceOf(InvalidOperationError);
    await expect(service.follow(ada, 'ghost')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('unfollows, and unfollowing someone you never followed is not an error', async () => {
    await service.follow(sam, 'ada');
    expect((await service.unfollow(sam, 'ada')).profile).toMatchObject({
      followerCount: 0,
      followedByViewer: false,
    });
    await expect(service.unfollow(sam, 'ada')).resolves.toMatchObject({
      profile: { followerCount: 0 },
    });
  });

  it('lists followers and following, newest first, marking who the viewer already follows', async () => {
    await service.follow(sam, 'ada');
    await service.follow(grace, 'ada');
    await service.follow(ada, 'grace');

    const followers = await service.followers('ada', ada, 50);
    expect(followers.map((profile) => profile.handle)).toEqual(['grace', 'sam']);
    expect(followers.map((profile) => profile.followedByViewer)).toEqual([true, false]);

    expect((await service.following('ada', null, 50)).map((p) => p.handle)).toEqual(['grace']);
    expect(await service.followers('ada', ada, 1)).toHaveLength(1);
  });

  it('shows only the public boards on a profile, whoever is looking', async () => {
    await repos.collections.create({
      ownerId: ada,
      title: 'Open',
      description: '',
      visibility: 'public',
    });
    await repos.collections.create({
      ownerId: ada,
      title: 'Closed',
      description: '',
      visibility: 'private',
    });

    for (const viewer of [null, sam, ada]) {
      const { profile, boards } = await service.profile('ada', viewer);
      expect(boards.map((board) => board.title)).toEqual(['Open']);
      expect(profile.boardCount).toBe(1);
    }
  });
});
