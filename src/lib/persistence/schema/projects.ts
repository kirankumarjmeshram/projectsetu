import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  mode: text("mode").notNull(), // ProjectMode enum value
  industryActivity: text("industry_activity").notNull(),
  stage: text("stage").notNull(), // ProjectStage enum value
  status: text("status").notNull().default("DRAFT"), // ProjectStatus enum value
  areaClassification: text("area_classification")
    .notNull()
    .default("UNCLASSIFIED"),
  location: jsonb("location"), // PostalAddress + classification source
  projectionPeriodYears: integer("projection_period_years").notNull(),
  implementationFrom: text("implementation_from"), // ISODate
  implementationUntil: text("implementation_until"), // ISODate
  currentInputSnapshotId: uuid("current_input_snapshot_id"), // FK set after first snapshot
  ownerId: uuid("owner_id").references(() => users.id),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
