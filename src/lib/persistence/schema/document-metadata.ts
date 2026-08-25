import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const documentMetadata = pgTable("document_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  kind: text("kind").notNull(), // DocumentKind
  displayName: text("display_name"),
  originalFilename: text("original_filename"),
  version: text("version").default("1"),
  storageKey: text("storage_key"), // provider-agnostic reference
  mimeType: text("mime_type"),
  sizeBytes: text("size_bytes"), // stored as text to avoid int overflow for large files
  checksumSha256: text("checksum_sha256"),
  status: text("status").notNull().default("UPLOADED"), // DocumentStatus
  supersededById: uuid("superseded_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
