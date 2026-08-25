import {
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { documentMetadata } from "./document-metadata";
import { projects } from "./projects";

export const quotationExtractions = pgTable("quotation_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documentMetadata.id),
  status: text("status").notNull().default("PROPOSED"), // PROPOSED | REVIEWED | APPROVED | REJECTED
  extractionProvider: text("extraction_provider").notNull(), // MANUAL_ENTRY | RULE_BASED | etc.
  rawData: jsonb("raw_data").notNull(), // Immutable raw extraction payload
  normalizedData: jsonb("normalized_data").notNull(), // Normalized proposal
  confidenceScore: numeric("confidence_score", {
    precision: 5,
    scale: 2,
  }).default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
