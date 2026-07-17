ALTER TABLE "workspace_shares" DROP CONSTRAINT "workspace_shares_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_versions" DROP CONSTRAINT "workspace_versions_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_id_tenant_unique" UNIQUE("id","tenant_id");