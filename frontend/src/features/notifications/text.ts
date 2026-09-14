import type { Notification } from '@trove/shared';

/** One sentence per notification, from the perspective of the reader. */
export function describeNotification(notification: Notification, readerId: string): string {
  const actor = notification.actor.displayName;
  const board = notification.collection.title;
  switch (notification.type) {
    case 'item_added':
      return `${actor} added an image to ${board}`;
    case 'item_removed':
      return `${actor} removed an image from ${board}`;
    case 'item_updated':
      return notification.payload.moved === true
        ? `${actor} moved an image out of ${board}`
        : `${actor} edited an image on ${board}`;
    case 'collection_updated': {
      const changes = Array.isArray(notification.payload.changes) ? (notification.payload.changes as string[]) : [];
      if (changes.includes('title')) return `${actor} renamed a board to ${board}`;
      if (changes.includes('visibility')) return `${actor} changed who can see ${board}`;
      return `${actor} updated ${board}`;
    }
    case 'member_added':
      return notification.payload.userId === readerId
        ? `${actor} added you to ${board}`
        : `${actor} added someone to ${board}`;
  }
}
