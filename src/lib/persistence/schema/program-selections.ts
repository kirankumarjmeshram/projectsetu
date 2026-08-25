import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const programSelections = pgTable("program_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  programId: text("program_id").notNull(), // ProgramId (branded string)
  versionId: text("version_id"), // ProgramVersionId (optional)
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
