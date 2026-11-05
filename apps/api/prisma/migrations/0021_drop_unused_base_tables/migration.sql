-- Drops base-app tables that no Loopwise code reads or writes (clinic pivot cleanup, 5 Nov 2026): activity logging,
-- product analytics, automations, keyed locks, the project log, notifications, user-group membership and the
-- OAuth provider / JWT plugin tables (those better-auth plugins are not enabled). All were empty in development.
-- CASCADE removes their foreign keys, indexes and any RLS policies with them.

DROP TABLE IF EXISTS "automation_run" CASCADE;
DROP TABLE IF EXISTS "automation" CASCADE;
DROP TABLE IF EXISTS "activity" CASCADE;
DROP TABLE IF EXISTS "analytics_event" CASCADE;
DROP TABLE IF EXISTS "keyed_lock" CASCADE;
DROP TABLE IF EXISTS "log" CASCADE;
DROP TABLE IF EXISTS "notification_unsubscribe" CASCADE;
DROP TABLE IF EXISTS "notification" CASCADE;
DROP TABLE IF EXISTS "user_group_member" CASCADE;
DROP TABLE IF EXISTS "oauth_access_token" CASCADE;
DROP TABLE IF EXISTS "oauth_refresh_token" CASCADE;
DROP TABLE IF EXISTS "oauth_consent" CASCADE;
DROP TABLE IF EXISTS "oauth_client" CASCADE;
DROP TABLE IF EXISTS "jwks" CASCADE;
