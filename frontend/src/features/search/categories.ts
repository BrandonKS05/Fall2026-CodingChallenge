/**
 * The categories the photo library indexes, with a line about each and a colour
 * pair to wash their card in. The washes are the app's own palette rather than a
 * borrowed photo, so a category grid stays on the dark stage instead of turning
 * into someone else's magazine cover.
 */
import type { SearchCategory } from '@wumboo/shared';

export interface CategoryLook {
  label: string;
  blurb: string;
  /** from → to, as Tailwind colour stops. */
  from: string;
  to: string;
}

export const CATEGORIES: Record<SearchCategory, CategoryLook> = {
  animals: {
    label: 'Animals',
    blurb: 'Creatures close up and far off, from the family pet to the far field.',
    from: 'from-amber-500/70',
    to: 'to-orange-700/70',
  },
  backgrounds: {
    label: 'Backgrounds',
    blurb: 'Textures and washes for whatever you are putting in front of them.',
    from: 'from-slate-500/70',
    to: 'to-slate-800/70',
  },
  buildings: {
    label: 'Buildings',
    blurb: 'Concrete, glass and brick, from a doorway to a skyline.',
    from: 'from-zinc-400/70',
    to: 'to-zinc-700/70',
  },
  business: {
    label: 'Business',
    blurb: 'Desks, meetings and the quiet machinery of getting things done.',
    from: 'from-sky-600/70',
    to: 'to-indigo-800/70',
  },
  computer: {
    label: 'Computer',
    blurb: 'Screens, cables and the parts of the machine nobody usually sees.',
    from: 'from-cyan-500/70',
    to: 'to-blue-800/70',
  },
  education: {
    label: 'Education',
    blurb: 'Books, boards and rooms built for learning something.',
    from: 'from-emerald-500/70',
    to: 'to-teal-800/70',
  },
  fashion: {
    label: 'Fashion',
    blurb: 'What people wear, and how it is photographed.',
    from: 'from-pink-500/70',
    to: 'to-rose-800/70',
  },
  feelings: {
    label: 'Feelings',
    blurb: 'Faces and moments carrying more than they show.',
    from: 'from-fuchsia-500/70',
    to: 'to-purple-800/70',
  },
  food: {
    label: 'Food',
    blurb: 'Kitchens, plates and the things that end up on them.',
    from: 'from-orange-400/70',
    to: 'to-red-700/70',
  },
  health: {
    label: 'Health',
    blurb: 'Movement, rest and the business of looking after yourself.',
    from: 'from-lime-500/70',
    to: 'to-green-800/70',
  },
  industry: {
    label: 'Industry',
    blurb: 'Where things are made, at the scale they are made at.',
    from: 'from-stone-400/70',
    to: 'to-stone-700/70',
  },
  music: {
    label: 'Music',
    blurb: 'Instruments, stages and the rooms that hold them.',
    from: 'from-violet-500/70',
    to: 'to-indigo-800/70',
  },
  nature: {
    label: 'Nature',
    blurb: 'Weather, water and light doing the work for free.',
    from: 'from-green-500/70',
    to: 'to-emerald-900/70',
  },
  people: {
    label: 'People',
    blurb: 'Portraits and crowds, at work and at rest.',
    from: 'from-rose-400/70',
    to: 'to-pink-800/70',
  },
  places: {
    label: 'Places',
    blurb: 'Somewhere in particular, photographed like it matters.',
    from: 'from-teal-500/70',
    to: 'to-cyan-900/70',
  },
  religion: {
    label: 'Religion',
    blurb: 'Quiet interiors and the objects kept in them.',
    from: 'from-amber-400/70',
    to: 'to-yellow-800/70',
  },
  science: {
    label: 'Science',
    blurb: 'Instruments, samples and very close looks at small things.',
    from: 'from-blue-500/70',
    to: 'to-violet-900/70',
  },
  sports: {
    label: 'Sports',
    blurb: 'Bodies mid-effort, and the surfaces they play on.',
    from: 'from-red-500/70',
    to: 'to-rose-900/70',
  },
  transportation: {
    label: 'Transportation',
    blurb: 'Roads, rails and everything moving along them.',
    from: 'from-yellow-500/70',
    to: 'to-amber-800/70',
  },
  travel: {
    label: 'Travel',
    blurb: 'Elsewhere, and the light it has at the right hour.',
    from: 'from-indigo-400/70',
    to: 'to-blue-900/70',
  },
};

/** A handful of neighbours to offer at the bottom of a category, chosen by hand. */
export const NEAR: Partial<Record<SearchCategory, SearchCategory[]>> = {
  animals: ['nature', 'places', 'people', 'travel'],
  nature: ['animals', 'travel', 'places', 'science'],
  food: ['health', 'business', 'nature', 'people'],
  buildings: ['places', 'industry', 'travel', 'business'],
  travel: ['places', 'nature', 'buildings', 'transportation'],
  people: ['feelings', 'fashion', 'health', 'business'],
};

/** Everything else gets the same sensible four. */
export const DEFAULT_NEAR: SearchCategory[] = ['nature', 'people', 'places', 'backgrounds'];

/** Every category, in the order the record lists them, for the browse grid. */
export const ALL_CATEGORIES = Object.keys(CATEGORIES) as SearchCategory[];
