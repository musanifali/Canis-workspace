-- Custom SQL migration file, put your code below! --

-- Append-only, loudly (#27). The RLS layer already has no UPDATE/DELETE
-- policies for these tables, but policy absence makes such statements a
-- silent 0-row no-op. Revoking the privilege turns any UPDATE/DELETE attempt
-- by the service role into a hard "permission denied" error instead —
-- tampering with history should never fail quietly.
REVOKE UPDATE, DELETE ON workspace_versions FROM workspace_service;
REVOKE UPDATE, DELETE ON audit_log FROM workspace_service;
