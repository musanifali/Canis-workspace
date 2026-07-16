CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"workspace_id" text,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "data_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_contracts_tenant_entity_unique" UNIQUE("tenant_id","entity_name")
);
--> statement-breakpoint
ALTER TABLE "data_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"role" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_shares_subject_unique" UNIQUE("workspace_id","subject_type","subject_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspace_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"spec" jsonb NOT NULL,
	"spec_version" integer NOT NULL,
	"prompt" text,
	"verdict" jsonb NOT NULL,
	"author_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_versions_workspace_version_unique" UNIQUE("workspace_id","version_number"),
	CONSTRAINT "workspace_versions_version_positive" CHECK ("workspace_versions"."version_number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "workspace_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"head_version" integer NOT NULL,
	"owner_user_id" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_from_thread_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspaces_head_version_positive" CHECK ("workspaces"."head_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_contracts" ADD CONSTRAINT "data_contracts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_shares" ADD CONSTRAINT "workspace_shares_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_shares" ADD CONSTRAINT "workspace_shares_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_versions" ADD CONSTRAINT "workspace_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_versions" ADD CONSTRAINT "workspace_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_tenant_created_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_workspace_id_idx" ON "audit_log" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "data_contracts_tenant_id_idx" ON "data_contracts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workspace_shares_tenant_id_idx" ON "workspace_shares" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workspace_shares_workspace_id_idx" ON "workspace_shares" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_versions_tenant_id_idx" ON "workspace_versions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "workspace_versions_workspace_id_idx" ON "workspace_versions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspaces_tenant_id_idx" ON "workspaces" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "audit_log_service_select" ON "audit_log" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("audit_log"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "audit_log_service_insert" ON "audit_log" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK ("audit_log"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "data_contracts_service_select" ON "data_contracts" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("data_contracts"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "data_contracts_service_insert" ON "data_contracts" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK ("data_contracts"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "data_contracts_service_update" ON "data_contracts" AS PERMISSIVE FOR UPDATE TO "workspace_service" USING ("data_contracts"."tenant_id" = current_setting('app.tenant_id')) WITH CHECK ("data_contracts"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "data_contracts_service_delete" ON "data_contracts" AS PERMISSIVE FOR DELETE TO "workspace_service" USING ("data_contracts"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "tenants_service_select" ON "tenants" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("tenants"."id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspace_shares_service_select" ON "workspace_shares" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("workspace_shares"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspace_shares_service_insert" ON "workspace_shares" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK ("workspace_shares"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspace_shares_service_update" ON "workspace_shares" AS PERMISSIVE FOR UPDATE TO "workspace_service" USING ("workspace_shares"."tenant_id" = current_setting('app.tenant_id')) WITH CHECK ("workspace_shares"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspace_shares_service_delete" ON "workspace_shares" AS PERMISSIVE FOR DELETE TO "workspace_service" USING ("workspace_shares"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspace_versions_service_select" ON "workspace_versions" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("workspace_versions"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspace_versions_service_insert" ON "workspace_versions" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK ("workspace_versions"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspaces_service_select" ON "workspaces" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("workspaces"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspaces_service_insert" ON "workspaces" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK ("workspaces"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "workspaces_service_update" ON "workspaces" AS PERMISSIVE FOR UPDATE TO "workspace_service" USING ("workspaces"."tenant_id" = current_setting('app.tenant_id')) WITH CHECK ("workspaces"."tenant_id" = current_setting('app.tenant_id'));