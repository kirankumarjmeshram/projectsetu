import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { documentMetadata } from "./document-metadata";
import { projects } from "./projects";

export const quotationLineMappings = pgTable("quotation_line_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documentMetadata.id),
  quotationLineId: text("quotation_line_id").notNull(),
  projectCostItemId: text("project_cost_item_id"),
  costCategory: text("cost_category").notNull(), // ProjectCostCategory
  sourceAmount: numeric("source_amount", { precision: 20, scale: 2 }).notNull(),
  mappedAmount: numeric("mapped_amount", { precision: 20, scale: 2 }).notNull(),
  mappingType: text("mapping_type").notNull().default("NEW_ITEM"), // NEW_ITEM | EXISTING_ITEM | PARTIAL_ALLOCATION | AGGREGATED
  status: text("status").notNull().default("ACTIVE"), // ACTIVE | SUPERSEDED | REMOVED
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
