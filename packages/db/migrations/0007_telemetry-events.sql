CREATE TABLE "telemetry_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sdk_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telemetry_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "telemetry_events_event_idx" ON "telemetry_events" USING btree ("event");--> statement-breakpoint
CREATE INDEX "telemetry_events_created_idx" ON "telemetry_events" USING btree ("created_at");--> statement-breakpoint
CREATE POLICY "telemetry_events_service_select" ON "telemetry_events" AS PERMISSIVE FOR SELECT TO "workspace_service" USING (true);--> statement-breakpoint
CREATE POLICY "telemetry_events_service_insert" ON "telemetry_events" AS PERMISSIVE FOR INSERT TO "workspace_service" WITH CHECK (true);