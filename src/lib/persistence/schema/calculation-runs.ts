import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projectInputSnapshots } from "./project-input-snapshots";
import { projects } from "./projects";

export const calculationRuns = pgTable("calculation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  inputSnapshotId: uuid("input_snapshot_id")
    .notNull()
    .references(() => projectInputSnapshots.id),
  status: text("status").notNull().default("PENDING"), // PENDING | COMPLETED | FAILED
  triggeredBy: text("triggered_by"), // user/system identifier
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
