/** Relation metadata for Drizzle's relational query API. No effect on the SQL schema. */
import { relations } from 'drizzle-orm';
import { collectionItems } from './collectionItems.js';
import { collectionLikes } from './collectionLikes.js';
import { collectionMembers } from './collectionMembers.js';
import { collections } from './collections.js';
import { images } from './images.js';
import { notifications } from './notifications.js';
import { users } from './users.js';

export const usersRelations = relations(users, ({ many }) => ({
  ownedCollections: many(collections),
  memberships: many(collectionMembers),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  owner: one(users, { fields: [collections.ownerId], references: [users.id] }),
  items: many(collectionItems),
  members: many(collectionMembers),
  likes: many(collectionLikes),
}));

export const collectionLikesRelations = relations(collectionLikes, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionLikes.collectionId],
    references: [collections.id],
  }),
  user: one(users, { fields: [collectionLikes.userId], references: [users.id] }),
}));

export const imagesRelations = relations(images, ({ many }) => ({
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  image: one(images, { fields: [collectionItems.imageId], references: [images.id] }),
  addedBy: one(users, { fields: [collectionItems.addedById], references: [users.id] }),
}));

export const collectionMembersRelations = relations(collectionMembers, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionMembers.collectionId],
    references: [collections.id],
  }),
  user: one(users, { fields: [collectionMembers.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientId],
    references: [users.id],
    relationName: 'notificationRecipient',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'notificationActor',
  }),
  collection: one(collections, {
    fields: [notifications.collectionId],
    references: [collections.id],
  }),
}));
