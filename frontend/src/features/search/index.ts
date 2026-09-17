/** Search feature: the surface other parts of the app may import. */
export { ALL_CATEGORIES, CATEGORIES } from './categories';
export { CategoryGrid } from './components/CategoryGrid';
export { FilterPanel } from './components/FilterPanel';
export { ImageSearchButton } from './components/ImageSearchButton';
export { ResultGrid, ResultGridSkeleton } from './components/ResultGrid';
export { SearchBar } from './components/SearchBar';
export {
  EMPTY_FILTERS,
  effectiveScope,
  readFilters,
  scopeIncludes,
  searchTerm,
  toImageQuery,
  writeFilters,
  type SearchFilters,
  type SearchScope,
} from './filters';
export { useCategoryCovers, useImageSearch } from './queries';
