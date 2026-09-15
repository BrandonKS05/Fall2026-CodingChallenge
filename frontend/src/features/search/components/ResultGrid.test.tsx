import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { searchResultFixture } from '@/testing/fixtures';
import { ResultGrid } from './ResultGrid';

describe('ResultGrid', () => {
  it('shows an image once however many pages it turns up on', () => {
    const results = [
      searchResultFixture('p1', { tags: ['heron'] }),
      searchResultFixture('p2', { tags: ['fox'] }),
      // Page two repeats the first hit, as a popular-first listing does.
      searchResultFixture('p1', { tags: ['heron'] }),
    ];
    render(
      <ResultGrid
        results={results}
        savedTo={{}}
        onSave={vi.fn()}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getAllByAltText('heron')).toHaveLength(1);
    expect(screen.getByAltText('fox')).toBeInTheDocument();
  });
});
