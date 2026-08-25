import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const projectInputSnapshots = pgTable("project_input_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  snapshotType: text("snapshot_type").notNull().default("PROJECT_INPUT"),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull(),
  data: jsonb("data").notNull(), // Immutable project input snapshot
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
