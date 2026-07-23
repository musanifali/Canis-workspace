ALTER TABLE "tenants" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
-- Tenants that predate tiers were effectively uncapped; keep them that way
-- (internal = unlimited) rather than silently dropping them onto the free cap.
-- New tenants inserted after this migration still default to 'free'.
UPDATE "tenants" SET "plan" = 'internal';