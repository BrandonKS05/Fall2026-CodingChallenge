/**
 * One picture to stand for each category on the browse grid. Fixed, like the
 * landing curation, and stored in our own bucket: a cover chosen fresh from the
 * provider on every visit would be a different picture each day, and the URLs
 * the provider hands out expire within one.
 */
import type { SearchCategory } from '@wumboo/shared';
import { LANDING_PROVIDER } from './landingImages.js';

export const COVER_PROVIDER = LANDING_PROVIDER;

export const CATEGORY_COVER_IDS: Record<SearchCategory, string> = {
  backgrounds: '6373296', // Water drops over a gradient
  fashion: '1868701', // Model, studio light
  nature: '8844310', // Lake, forest, a dock
  science: '3658992', // Microbiology under the lens
  education: '2596809', // Library, books to the ceiling
  feelings: '2567915', // Two people talking, laughing
  health: '2587066', // Yoga, held still
  people: '1845166', // A face, close
  religion: '3984946', // Buddhist temple, pagoda
  places: '1572444', // London, the Eye
  animals: '1822535', // Tiger
  industry: '1140760', // Factory against the sky
  computer: '2620118', // Laptop, code on screen
  food: '8210152', // Fish, laid out
  sports: '2678544', // Tartan track
  transportation: '5237269', // Shinkansen at the platform
  travel: '2373727', // Airport, waiting
  buildings: '7868160', // Glass facade
  business: '1979261', // A meeting, mid-sentence
  music: '2179313', // Guitar, on stage
};
