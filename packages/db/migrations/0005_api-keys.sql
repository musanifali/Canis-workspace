CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "api_keys_service_select" ON "api_keys" AS PERMISSIVE FOR SELECT TO "workspace_service" USING ("api_keys"."tenant_id" = current_setting('app.tenant_id'));