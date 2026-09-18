import { SEARCH_CATEGORIES, type SearchCategory } from '@wumboo/shared';

/**
 * What each category actually means, in words worth embedding.
 *
 * The category name alone is a poor anchor — "nature" as a bare token sits
 * near nothing in particular — so each one is written out as the kind of
 * picture it stands for. These are the vectors a new account's interests are
 * seeded from, so they are the first thing the feed knows about anybody.
 */
export const CATEGORY_TEXT: Record<SearchCategory, string> = {
  backgrounds:
    'abstract backgrounds, textures, gradients, patterns, wallpaper, surfaces, colour fields',
  fashion:
    'fashion, clothing, style, models, studio portraits, accessories, shoes, jewellery, runway',
  nature:
    'nature, forests, mountains, coastline, rivers, weather, flowers, trees, wilderness, landscapes',
  science:
    'science, laboratory, microscopy, chemistry, physics, research, experiments, space, medicine',
  education:
    'education, books, libraries, classrooms, studying, universities, learning, teaching, writing',
  feelings:
    'feelings, emotion, friendship, love, laughter, loneliness, people together, human expression',
  health:
    'health, fitness, yoga, exercise, wellbeing, medicine, nutrition, running, meditation, care',
  people: 'people, portraits, faces, crowds, children, families, working, hands, everyday life',
  religion:
    'religion, temples, churches, mosques, prayer, ritual, faith, spirituality, sacred places',
  places: 'places, cities, landmarks, streets, monuments, countries, skylines, neighbourhoods',
  animals: 'animals, wildlife, birds, pets, dogs, cats, insects, fish, mammals, creatures',
  industry:
    'industry, factories, machinery, construction, engineering, warehouses, tools, manufacturing',
  computer: 'computers, code, screens, software, technology, servers, keyboards, developers, data',
  food: 'food, cooking, meals, ingredients, baking, restaurants, drinks, produce, kitchens, recipes',
  sports: 'sport, athletes, football, running, stadiums, competition, training, cycling, swimming',
  transportation: 'transport, cars, trains, bicycles, aeroplanes, ships, roads, traffic, stations',
  travel:
    'travel, holidays, airports, maps, luggage, tourism, adventure, hotels, journeys, exploring',
  buildings:
    'buildings, architecture, interiors, houses, facades, bridges, rooms, design, structures',
  business: 'business, offices, meetings, work, finance, charts, teamwork, professionals, commerce',
  music: 'music, instruments, concerts, guitars, singers, stages, records, headphones, performance',
};

/** The categories in the order the contract lists them. */
export const CATEGORIES: readonly SearchCategory[] = SEARCH_CATEGORIES;
