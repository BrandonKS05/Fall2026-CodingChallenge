/**
 * The people who live in this app, and what they collect.
 *
 * A gallery with one account called "Demo User" reads as a fixture; a gallery
 * with a dozen people who each keep two or three boards reads as a place. The
 * accounts are fictional, the pictures are the provider's, and the passwords
 * are all the same one, which is the point of a demo.
 */
import type { CollectionVisibility } from '../../domain/entities/Collection.js';

export const SEED_PASSWORD = 'demo-password-123';

export interface PersonSeed {
  email: string;
  handle: string;
  displayName: string;
  bio: string;
}

/**
 * The first is the account the README hands to a grader: a real person with a
 * real shelf, who happens to have the address everyone is told to log in with.
 */
export const SEED_PEOPLE: PersonSeed[] = [
  {
    email: 'demo@wumboo.app',
    handle: 'ninaokafor',
    displayName: 'Nina Okafor',
    bio: 'Kitchens, clay, and whatever the light is doing at four in the afternoon.',
  },
  {
    email: 'sam@wumboo.app',
    handle: 'samrivera',
    displayName: 'Sam Rivera',
    bio: 'Cold water and rock pools. Always one more rock.',
  },
  {
    email: 'mara@wumboo.app',
    handle: 'marabekele',
    displayName: 'Mara Bekele',
    bio: 'Architecture student. Concrete is a material, not a mood.',
  },
  {
    email: 'tobias@wumboo.app',
    handle: 'tobiasleung',
    displayName: 'Tobias Leung',
    bio: 'Night shifts, neon, and the walk home.',
  },
  {
    email: 'juniper@wumboo.app',
    handle: 'juniperhale',
    displayName: 'Juniper Hale',
    bio: 'Alpine season. I collect weather.',
  },
  {
    email: 'oren@wumboo.app',
    handle: 'orenkatz',
    displayName: 'Oren Katz',
    bio: 'Long tables, short recipes.',
  },
  {
    email: 'priya@wumboo.app',
    handle: 'priyaraman',
    displayName: 'Priya Raman',
    bio: 'Textiles, dye, and slow mornings.',
  },
  {
    email: 'luca@wumboo.app',
    handle: 'lucaferrari',
    displayName: 'Luca Ferrari',
    bio: 'Roads, rails, and the middle of nowhere.',
  },
  {
    email: 'hana@wumboo.app',
    handle: 'hanaoshiro',
    displayName: 'Hana Oshiro',
    bio: 'Studio pottery. Mostly bowls.',
  },
  {
    email: 'dex@wumboo.app',
    handle: 'dexcarver',
    displayName: 'Dex Carver',
    bio: 'Desert light and long drives.',
  },
];

export interface BoardSeed {
  /** The owner's handle. */
  owner: string;
  title: string;
  description: string;
  visibility: CollectionVisibility;
  /** What the board is filled from, through the same search the app offers. */
  query: string;
  count: number;
  /** Creates a share link so the demo has a working /s/<slug> page. */
  shareLink?: boolean;
  /** Adds this handle as an editor, which also exercises notifications. */
  editor?: string;
}

export const SEED_BOARDS: BoardSeed[] = [
  {
    owner: 'ninaokafor',
    title: 'Warm kitchens',
    description: 'Oak, brass, and low afternoon light.',
    visibility: 'public',
    query: 'kitchen interior wood',
    count: 8,
  },
  {
    owner: 'ninaokafor',
    title: 'Ceramics',
    description: 'Glaze, grit, and thumbprints.',
    visibility: 'public',
    query: 'ceramic pottery handmade',
    count: 8,
  },
  {
    owner: 'ninaokafor',
    title: 'Fog and pines',
    description: 'The Pacific Northwest on a slow morning.',
    visibility: 'unlisted',
    query: 'foggy forest pine',
    count: 6,
    shareLink: true,
  },
  {
    owner: 'ninaokafor',
    title: 'Brutalist libraries',
    description: 'Concrete, light, and silence.',
    visibility: 'private',
    query: 'brutalist architecture concrete',
    count: 6,
  },
  {
    owner: 'samrivera',
    title: 'Tide pools',
    description: 'Anemones, urchins, and whatever the tide left.',
    visibility: 'private',
    query: 'tide pool',
    count: 6,
    editor: 'ninaokafor',
  },
  {
    owner: 'samrivera',
    title: 'Cold water',
    description: 'Grey sea, grey sky, wetsuit weather.',
    visibility: 'public',
    query: 'cold ocean waves coast',
    count: 7,
  },
  {
    owner: 'marabekele',
    title: 'Concrete and light',
    description: 'Shadow does the drawing.',
    visibility: 'public',
    query: 'concrete architecture shadow',
    count: 8,
  },
  {
    owner: 'marabekele',
    title: 'Glass facades',
    description: 'Buildings reflecting other buildings.',
    visibility: 'public',
    query: 'glass facade building reflection',
    count: 7,
  },
  {
    owner: 'tobiasleung',
    title: 'Neon after rain',
    description: 'Wet streets doing the lighting for free.',
    visibility: 'public',
    query: 'neon city night rain',
    count: 8,
  },
  {
    owner: 'tobiasleung',
    title: 'Last train',
    description: 'Platforms, windows, and people almost asleep.',
    visibility: 'public',
    query: 'train station night platform',
    count: 7,
  },
  {
    owner: 'juniperhale',
    title: 'Alpine mornings',
    description: 'Cold lakes and first light.',
    visibility: 'public',
    query: 'mountain lake sunrise',
    count: 8,
  },
  {
    owner: 'juniperhale',
    title: 'First snow',
    description: 'The week everything goes quiet.',
    visibility: 'public',
    query: 'snow forest winter',
    count: 7,
  },
  {
    owner: 'orenkatz',
    title: 'Long tables',
    description: 'Dinner, halfway through.',
    visibility: 'public',
    query: 'dinner table food spread',
    count: 8,
  },
  {
    owner: 'orenkatz',
    title: 'Steam and butter',
    description: 'Close enough to smell it.',
    visibility: 'public',
    query: 'cooking pan kitchen food',
    count: 7,
  },
  {
    owner: 'priyaraman',
    title: 'Indigo and thread',
    description: 'Dye baths, drying lines, blue hands.',
    visibility: 'public',
    query: 'indigo textile fabric dye',
    count: 7,
  },
  {
    owner: 'priyaraman',
    title: 'Slow mornings',
    description: 'Tea, linen, and nowhere to be.',
    visibility: 'public',
    query: 'tea morning linen still life',
    count: 7,
  },
  {
    owner: 'lucaferrari',
    title: 'Empty roads',
    description: 'Somewhere between two towns.',
    visibility: 'public',
    query: 'empty road landscape drive',
    count: 8,
  },
  {
    owner: 'lucaferrari',
    title: 'Platform edge',
    description: 'Rails, gravel, and the yellow line.',
    visibility: 'public',
    query: 'railway tracks train',
    count: 7,
  },
  {
    owner: 'hanaoshiro',
    title: 'Thumbprints',
    description: 'Hands on the wheel, mid-pull.',
    visibility: 'public',
    query: 'pottery wheel hands clay',
    count: 8,
  },
  {
    owner: 'hanaoshiro',
    title: 'Glaze tests',
    description: 'Twenty bowls, one question.',
    visibility: 'public',
    query: 'ceramic bowls glaze',
    count: 7,
  },
  {
    owner: 'dexcarver',
    title: 'Desert light',
    description: 'Dunes, ochre, and long shadows.',
    visibility: 'public',
    query: 'desert dunes sunset',
    count: 8,
  },
  {
    owner: 'dexcarver',
    title: 'Dunes at dusk',
    description: 'The half hour when the sand goes pink.',
    visibility: 'public',
    query: 'sand dunes evening',
    count: 7,
  },
];

/** Who follows whom: enough of a web that every profile has both sides filled. */
export const SEED_FOLLOWS: [follower: string, followee: string][] = [
  ['samrivera', 'ninaokafor'],
  ['marabekele', 'ninaokafor'],
  ['tobiasleung', 'ninaokafor'],
  ['juniperhale', 'ninaokafor'],
  ['orenkatz', 'ninaokafor'],
  ['hanaoshiro', 'ninaokafor'],
  ['ninaokafor', 'hanaoshiro'],
  ['ninaokafor', 'orenkatz'],
  ['ninaokafor', 'samrivera'],
  ['ninaokafor', 'marabekele'],
  ['priyaraman', 'hanaoshiro'],
  ['priyaraman', 'orenkatz'],
  ['lucaferrari', 'tobiasleung'],
  ['lucaferrari', 'dexcarver'],
  ['dexcarver', 'lucaferrari'],
  ['dexcarver', 'juniperhale'],
  ['tobiasleung', 'lucaferrari'],
  ['juniperhale', 'dexcarver'],
  ['hanaoshiro', 'priyaraman'],
  ['marabekele', 'tobiasleung'],
  ['orenkatz', 'priyaraman'],
  ['samrivera', 'juniperhale'],
];

/** A few likes, so the counts on a board are not all zero. */
export const SEED_LIKES: [liker: string, boardTitle: string][] = [
  ['samrivera', 'Warm kitchens'],
  ['marabekele', 'Warm kitchens'],
  ['hanaoshiro', 'Warm kitchens'],
  ['ninaokafor', 'Thumbprints'],
  ['priyaraman', 'Thumbprints'],
  ['orenkatz', 'Thumbprints'],
  ['ninaokafor', 'Alpine mornings'],
  ['dexcarver', 'Alpine mornings'],
  ['tobiasleung', 'Empty roads'],
  ['lucaferrari', 'Neon after rain'],
  ['juniperhale', 'Neon after rain'],
  ['ninaokafor', 'Concrete and light'],
  ['marabekele', 'Glaze tests'],
  ['samrivera', 'Cold water'],
  ['orenkatz', 'Slow mornings'],
  ['priyaraman', 'Indigo and thread'],
  ['dexcarver', 'Desert light'],
  ['juniperhale', 'First snow'],
];
