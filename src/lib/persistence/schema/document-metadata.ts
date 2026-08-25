import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const documentMetadata = pgTable("document_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  kind: text("kind").notNull(), // DocumentKind
  displayName: text("display_name"),
  version: text("version"),
  storageKey: text("storage_key"), // provider-agnostic reference
  mimeType: text("mime_type"),
  sizeBytes: text("size_bytes"), // stored as text to avoid int overflow for large files
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
