/** Small formatting helpers shared by features. */

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "3 minutes ago", "yesterday", or a date, for timestamps in lists. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return pluralize(minutes, 'minute') + ' ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return pluralize(hours, 'hour') + ' ago';
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Splits "wood, warm,  kitchen" into ["wood", "warm", "kitchen"] without duplicates. */
export function parseTags(input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}
