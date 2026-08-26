ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "report_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "funding_snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "template_version" text DEFAULT 'BASE_BANKABLE_DPR/1.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "content_schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "content" jsonb;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "narrative_overrides" jsonb;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "pdf_document_id" uuid;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "docx_document_id" uuid;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD COLUMN IF NOT EXISTS "excel_document_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_input_snapshot_id_project_input_snapshots_id_fk" FOREIGN KEY ("input_snapshot_id") REFERENCES "public"."project_input_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_funding_snapshot_id_funding_snapshots_id_fk" FOREIGN KEY ("funding_snapshot_id") REFERENCES "public"."funding_snapshots"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_generated_document_id_document_metadata_id_fk" FOREIGN KEY ("generated_document_id") REFERENCES "public"."document_metadata"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_pdf_document_id_document_metadata_id_fk" FOREIGN KEY ("pdf_document_id") REFERENCES "public"."document_metadata"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_docx_document_id_document_metadata_id_fk" FOREIGN KEY ("docx_document_id") REFERENCES "public"."document_metadata"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_excel_document_id_document_metadata_id_fk" FOREIGN KEY ("excel_document_id") REFERENCES "public"."document_metadata"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;