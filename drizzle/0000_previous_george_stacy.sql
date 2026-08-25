CREATE TABLE "calculation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"input_snapshot_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"triggered_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calculation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"calculation_run_id" uuid NOT NULL,
	"snapshot_type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"display_name" text,
	"version" text,
	"storage_key" text,
	"mime_type" text,
	"size_bytes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"calculation_run_id" uuid NOT NULL,
	"snapshot_type" text DEFAULT 'FUNDING_COMPOSER' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"program_id" text NOT NULL,
	"version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_input_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"snapshot_type" text DEFAULT 'PROJECT_INPUT' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"industry_activity" text NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"area_classification" text DEFAULT 'UNCLASSIFIED' NOT NULL,
	"location" jsonb,
	"projection_period_years" integer NOT NULL,
	"implementation_from" text,
	"implementation_until" text,
	"current_input_snapshot_id" uuid,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"template_reference" text,
	"input_snapshot_id" uuid,
	"calculation_run_id" uuid,
	"program_context" jsonb,
	"sections" jsonb,
	"generated_document_id" uuid,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_input_snapshot_id_project_input_snapshots_id_fk" FOREIGN KEY ("input_snapshot_id") REFERENCES "public"."project_input_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calculation_snapshots" ADD CONSTRAINT "calculation_snapshots_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_metadata" ADD CONSTRAINT "document_metadata_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_snapshots" ADD CONSTRAINT "funding_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_snapshots" ADD CONSTRAINT "funding_snapshots_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_selections" ADD CONSTRAINT "program_selections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_input_snapshots" ADD CONSTRAINT "project_input_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_metadata" ADD CONSTRAINT "report_metadata_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;