CREATE TABLE IF NOT EXISTS "quotation_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" text DEFAULT 'PROPOSED' NOT NULL,
	"extraction_provider" text NOT NULL,
	"raw_data" jsonb NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"confidence_score" numeric(5, 2) DEFAULT '1.00',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_line_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"quotation_line_id" text NOT NULL,
	"project_cost_item_id" text,
	"cost_category" text NOT NULL,
	"source_amount" numeric(20, 2) NOT NULL,
	"mapped_amount" numeric(20, 2) NOT NULL,
	"mapping_type" text DEFAULT 'NEW_ITEM' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotation_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"extraction_id" uuid NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"reviewed_data" jsonb NOT NULL,
	"reviewer_notes" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_metadata" ALTER COLUMN "version" SET DEFAULT '1';--> statement-breakpoint
ALTER TABLE "document_metadata" ADD COLUMN IF NOT EXISTS "original_filename" text;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD COLUMN IF NOT EXISTS "checksum_sha256" text;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'UPLOADED' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD COLUMN IF NOT EXISTS "superseded_by_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_extractions" ADD CONSTRAINT "quotation_extractions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_extractions" ADD CONSTRAINT "quotation_extractions_document_id_document_metadata_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document_metadata"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_line_mappings" ADD CONSTRAINT "quotation_line_mappings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_line_mappings" ADD CONSTRAINT "quotation_line_mappings_document_id_document_metadata_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document_metadata"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_reviews" ADD CONSTRAINT "quotation_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quotation_reviews" ADD CONSTRAINT "quotation_reviews_extraction_id_quotation_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."quotation_extractions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;