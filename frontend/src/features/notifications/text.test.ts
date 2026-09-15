import type { Notification } from '@wumboo/shared';
import { describe, expect, it } from 'vitest';
import { describeNotification } from './text';

const base: Notification = {
  id: 'n1',
  type: 'item_added',
  collection: { id: 'c1', title: 'Kitchens' },
  actor: { id: 'u2', handle: 'grace', displayName: 'Grace' },
  payload: {},
  readAt: null,
  createdAt: new Date().toISOString(),
};

describe('describeNotification', () => {
  it.each([
    [{ type: 'item_added' }, 'Grace added an image to Kitchens'],
    [{ type: 'item_removed' }, 'Grace removed an image from Kitchens'],
    [{ type: 'item_updated', payload: { moved: true } }, 'Grace moved an image out of Kitchens'],
    [{ type: 'item_updated', payload: { moved: false } }, 'Grace edited an image on Kitchens'],
    [
      { type: 'collection_updated', payload: { changes: ['title'] } },
      'Grace renamed a board to Kitchens',
    ],
    [
      { type: 'collection_updated', payload: { changes: ['visibility'] } },
      'Grace changed who can see Kitchens',
    ],
    [{ type: 'member_added', payload: { userId: 'me' } }, 'Grace added you to Kitchens'],
    [{ type: 'member_added', payload: { userId: 'other' } }, 'Grace added someone to Kitchens'],
  ] satisfies [Partial<Notification>, string][])('%o', (overrides, expected) => {
    expect(describeNotification({ ...base, ...overrides } as Notification, 'me')).toBe(expected);
  });
});
