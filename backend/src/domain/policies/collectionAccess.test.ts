import { describe, expect, it } from 'vitest';
import {
  canEditItems,
  canManage,
  canView,
  roleAtLeast,
} from './collectionAccess.js';

describe('collection access policy', () => {
  it('ranks roles owner > editor > viewer', () => {
    expect(roleAtLeast('owner', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'editor')).toBe(true);
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
  });

  it('lets members view anything and non-members view only non-private boards', () => {
    expect(canView({ visibility: 'private' }, 'viewer')).toBe(true);
    expect(canView({ visibility: 'private' }, null)).toBe(false);
    expect(canView({ visibility: 'unlisted' }, null)).toBe(true);
    expect(canView({ visibility: 'public' }, null)).toBe(true);
  });

  it('reserves item edits for editors and owners', () => {
    expect(canEditItems('owner')).toBe(true);
    expect(canEditItems('editor')).toBe(true);
    expect(canEditItems('viewer')).toBe(false);
    expect(canEditItems(null)).toBe(false);
  });

  it('reserves management for owners', () => {
    expect(canManage('owner')).toBe(true);
    expect(canManage('editor')).toBe(false);
    expect(canManage(null)).toBe(false);
  });
});
