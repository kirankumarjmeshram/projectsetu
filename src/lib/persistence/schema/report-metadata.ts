import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const reportMetadata = pgTable("report_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  reportType: text("report_type").notNull(), // ReportType
  templateReference: text("template_reference"),
  inputSnapshotId: uuid("input_snapshot_id"), // FK reference to exact input version
  calculationRunId: uuid("calculation_run_id"), // FK reference to exact calc run
  programContext: jsonb("program_context"), // program/version context for DPR reproducibility
  sections: jsonb("sections"), // ReportSectionSelection[]
  generatedDocumentId: uuid("generated_document_id"), // FK to document_metadata
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
