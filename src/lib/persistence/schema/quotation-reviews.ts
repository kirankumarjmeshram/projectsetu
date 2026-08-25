import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { quotationExtractions } from "./quotation-extractions";

export const quotationReviews = pgTable("quotation_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  extractionId: uuid("extraction_id")
    .notNull()
    .references(() => quotationExtractions.id),
  status: text("status").notNull().default("DRAFT"), // DRAFT | APPROVED | REJECTED
  reviewedData: jsonb("reviewed_data").notNull(), // User-corrected, approved quotation structure
  reviewerNotes: text("reviewer_notes"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
