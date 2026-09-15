/** The public URL for a share slug. Built on the client so the API stays host-agnostic. */
export function shareUrl(slug: string): string {
  return `${window.location.origin}/s/${slug}`;
}
