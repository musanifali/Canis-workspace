-- Test database alongside the dev one; the integration suite migrates and
-- uses this so `db:studio`/dev data is never touched by tests.
CREATE DATABASE workspace_engine_test;
