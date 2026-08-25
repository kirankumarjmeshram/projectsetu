import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { calculationRuns } from "./calculation-runs";
import { projects } from "./projects";

export const calculationSnapshots = pgTable("calculation_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  calculationRunId: uuid("calculation_run_id")
    .notNull()
    .references(() => calculationRuns.id),
  snapshotType: text("snapshot_type").notNull(), // discriminated type
  schemaVersion: integer("schema_version").notNull().default(1),
  data: jsonb("data").notNull(), // Immutable calculation result snapshot
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
