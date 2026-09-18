import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { itemFixture } from '@/testing/fixtures';
import { renderWithProviders } from '@/testing/render';
import { ImageLightbox } from './ImageLightbox';

const items = [
  itemFixture({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', caption: 'Oak island' }),
  itemFixture({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', caption: 'Low tide' }),
  itemFixture({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', caption: 'Long shadows' }),
];

/** The spinner has no name of its own; it is the only thing on screen that spins. */
const spinner = () => document.querySelector('.animate-spin');
const picture = () => screen.getByRole('img', { hidden: true });

/** Owns the index the way a page does, so the arrows really move the carousel. */
function Harness({ start = 0 }: { start?: number }) {
  const [index, setIndex] = useState<number | null>(start);
  return (
    <ImageLightbox items={items} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
  );
}

describe('ImageLightbox', () => {
  it('holds a spinner where the picture will be, and shows it once it arrives', () => {
    renderWithProviders(<Harness />);

    // Nothing has loaded yet: a frame with a spinner in it, not an empty one.
    expect(spinner()).toBeInTheDocument();
    expect(picture()).toHaveClass('opacity-0');

    fireEvent.load(picture());
    expect(spinner()).not.toBeInTheDocument();
    expect(picture()).not.toHaveClass('opacity-0');
  });

  it('spins again for the next picture rather than blanking the frame', async () => {
    renderWithProviders(<Harness />);
    fireEvent.load(picture());
    expect(spinner()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByText('Low tide')).toBeInTheDocument();
    expect(spinner()).toBeInTheDocument();

    fireEvent.load(picture());
    expect(spinner()).not.toBeInTheDocument();
  });

  it('stops spinning for a picture that will never come', () => {
    renderWithProviders(<Harness />);
    fireEvent.error(picture());
    expect(spinner()).not.toBeInTheDocument();
  });

  it('says where you are on a line of its own, and what you are looking at above it', () => {
    renderWithProviders(<Harness start={1} />);
    const dots = screen.getAllByRole('button', { name: /^Image \d+ of 3$/ });
    expect(dots).toHaveLength(3);
    expect(dots[1]).toHaveAttribute('aria-current', 'true');

    // Two lines: the caption, then everything else sharing the second.
    expect(screen.getByText('Low tide')).toBeInTheDocument();
    expect(screen.getByText(/Added by/)).toHaveTextContent(/^Added by Ada · .+ · #island$/);
  });
});
