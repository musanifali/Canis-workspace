CREATE TABLE "usage_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"workspace_id" text,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_generation_budget" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "generation_rate_per_minute" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_events_tenant_created_idx" ON "usage_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_tenant_user_created_idx" ON "usage_events" USING btree ("tenant_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_events_workspace_id_idx" ON "usage_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE POLICY "usage_events_service_select" ON "usage_events" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("usage_events"."tenant_id" = current_setting('app.tenant_id'));--> statement-breakpoint
CREATE POLICY "usage_events_service_insert" ON "usage_events" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK ("usage_events"."tenant_id" = current_setting('app.tenant_id'));