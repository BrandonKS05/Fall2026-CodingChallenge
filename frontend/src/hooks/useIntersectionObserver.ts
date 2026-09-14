import { useEffect, useRef } from 'react';

interface Options {
  enabled?: boolean;
  rootMargin?: string;
}

/**
 * Calls `onIntersect` whenever the returned element scrolls into view.
 * The callback is kept in a ref so callers need not memoize it.
 */
export function useIntersectionObserver<T extends HTMLElement>(
  onIntersect: () => void,
  { enabled = true, rootMargin = '600px' }: Options = {},
) {
  const ref = useRef<T>(null);
  const callback = useRef(onIntersect);
  callback.current = onIntersect;

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
