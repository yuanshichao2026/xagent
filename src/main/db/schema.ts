import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  path: text('path').unique().notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  workspacePath: text('workspace_path').notNull(),
  title: text('title').notNull(),
  messagesJson: text('messages_json').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export type Workspace = typeof workspaces.$inferSelect;
export type Session = typeof sessions.$inferSelect;
