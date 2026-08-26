import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { calculationRuns } from "./calculation-runs";
import { documentMetadata } from "./document-metadata";
import { fundingSnapshots } from "./funding-snapshots";
import { projectInputSnapshots } from "./project-input-snapshots";
import { projects } from "./projects";

export const reportMetadata = pgTable("report_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  reportType: text("report_type").notNull(), // ReportType
  templateReference: text("template_reference"),
  reportVersion: integer("report_version").notNull().default(1),
  inputSnapshotId: uuid("input_snapshot_id").references(
    () => projectInputSnapshots.id,
  ),
  calculationRunId: uuid("calculation_run_id").references(
    () => calculationRuns.id,
  ),
  fundingSnapshotId: uuid("funding_snapshot_id").references(
    () => fundingSnapshots.id,
  ),
  templateVersion: text("template_version")
    .notNull()
    .default("BASE_BANKABLE_DPR/1.0"),
  contentSchemaVersion: integer("content_schema_version").notNull().default(1),
  status: text("status").notNull().default("DRAFT"),
  programContext: jsonb("program_context"), // program/version context for DPR reproducibility
  sections: jsonb("sections"), // ReportSectionSelection[]
  content: jsonb("content"),
  narrativeOverrides: jsonb("narrative_overrides"),
  generatedDocumentId: uuid("generated_document_id").references(
    () => documentMetadata.id,
  ),
  pdfDocumentId: uuid("pdf_document_id").references(() => documentMetadata.id),
  docxDocumentId: uuid("docx_document_id").references(
    () => documentMetadata.id,
  ),
  excelDocumentId: uuid("excel_document_id").references(
    () => documentMetadata.id,
  ),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
