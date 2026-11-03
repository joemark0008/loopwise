/*
  Warnings:

  - You are about to drop the column `disabled_mcp_servers` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `disabled_mcp_tools` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `discord_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `enabled_tools` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `known_mcp_servers` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `mattermost_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `mcp_endpoint_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `row_security` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `slack_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `teams_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `telegram_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the column `whatsapp_settings` on the `project` table. All the data in the column will be lost.
  - You are about to drop the `budget_notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `context_recommendation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `context_recommendation_config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `context_recommendation_linked_feedback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `context_recommendation_run` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `favorite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_call_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_chart_embed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_map_embed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_oauth_client` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_query_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mcp_user_token` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_discord_link` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_group_budget` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_provider_budget` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_query_tool` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_story_theme` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_warehouse_credentials` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_whatsapp_link` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sandbox_secret` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shared_story` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shared_story_access` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shared_story_group_access` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_app_state` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_bundle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_data_cache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_delivery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_draft_file` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_feedback` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_file` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_file_blob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_folder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_folder_item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `story_version` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `warehouse_connection_check` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activity" DROP CONSTRAINT "activity_shared_story_id_shared_story_id_fk";

-- DropForeignKey
ALTER TABLE "activity" DROP CONSTRAINT "activity_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "analytics_event" DROP CONSTRAINT "analytics_event_shared_story_id_shared_story_id_fk";

-- DropForeignKey
ALTER TABLE "analytics_event" DROP CONSTRAINT "analytics_event_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "budget_notification" DROP CONSTRAINT "budget_notification_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "context_recommendation" DROP CONSTRAINT "context_recommendation_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "context_recommendation" DROP CONSTRAINT "context_recommendation_run_fk";

-- DropForeignKey
ALTER TABLE "context_recommendation" DROP CONSTRAINT "context_recommendation_status_changed_by_user_id_fk";

-- DropForeignKey
ALTER TABLE "context_recommendation_config" DROP CONSTRAINT "context_recommendation_config_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "context_recommendation_linked_feedback" DROP CONSTRAINT "context_recommendation_linked_feedback_message_id_chat_message_";

-- DropForeignKey
ALTER TABLE "context_recommendation_linked_feedback" DROP CONSTRAINT "context_recommendation_linked_feedback_recommendation_id_contex";

-- DropForeignKey
ALTER TABLE "context_recommendation_run" DROP CONSTRAINT "context_recommendation_run_chat_id_chat_id_fk";

-- DropForeignKey
ALTER TABLE "context_recommendation_run" DROP CONSTRAINT "context_recommendation_run_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "favorite" DROP CONSTRAINT "favorite_folder_id_story_folder_id_fk";

-- DropForeignKey
ALTER TABLE "favorite" DROP CONSTRAINT "favorite_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "favorite" DROP CONSTRAINT "favorite_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_call_log" DROP CONSTRAINT "mcp_call_log_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_call_log" DROP CONSTRAINT "mcp_call_log_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_chart_embed" DROP CONSTRAINT "mcp_chart_embed_query_id_mcp_query_data_query_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_map_embed" DROP CONSTRAINT "mcp_map_embed_query_id_mcp_query_data_query_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_oauth_client" DROP CONSTRAINT "mcp_oauth_client_discovery_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_oauth_client" DROP CONSTRAINT "mcp_oauth_client_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_query_data" DROP CONSTRAINT "mcp_query_data_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_user_token" DROP CONSTRAINT "mcp_user_token_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "mcp_user_token" DROP CONSTRAINT "mcp_user_token_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "project_discord_link" DROP CONSTRAINT "project_discord_link_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_discord_link" DROP CONSTRAINT "project_discord_link_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "project_group_budget" DROP CONSTRAINT "project_group_budget_group_id_user_group_id_fk";

-- DropForeignKey
ALTER TABLE "project_group_budget" DROP CONSTRAINT "project_group_budget_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_provider_budget" DROP CONSTRAINT "project_provider_budget_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_query_tool" DROP CONSTRAINT "project_query_tool_created_by_user_id_fk";

-- DropForeignKey
ALTER TABLE "project_query_tool" DROP CONSTRAINT "project_query_tool_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_story_theme" DROP CONSTRAINT "project_story_theme_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_warehouse_credentials" DROP CONSTRAINT "project_warehouse_credentials_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_whatsapp_link" DROP CONSTRAINT "project_whatsapp_link_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "project_whatsapp_link" DROP CONSTRAINT "project_whatsapp_link_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "sandbox_secret" DROP CONSTRAINT "sandbox_secret_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "sandbox_secret" DROP CONSTRAINT "sandbox_secret_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story" DROP CONSTRAINT "shared_story_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story" DROP CONSTRAINT "shared_story_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story" DROP CONSTRAINT "shared_story_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story_access" DROP CONSTRAINT "shared_story_access_shared_story_id_shared_story_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story_access" DROP CONSTRAINT "shared_story_access_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story_group_access" DROP CONSTRAINT "shared_story_group_access_group_id_user_group_id_fk";

-- DropForeignKey
ALTER TABLE "shared_story_group_access" DROP CONSTRAINT "shared_story_group_access_shared_story_id_shared_story_id_fk";

-- DropForeignKey
ALTER TABLE "story" DROP CONSTRAINT "story_certified_by_user_id_fk";

-- DropForeignKey
ALTER TABLE "story" DROP CONSTRAINT "story_chat_id_chat_id_fk";

-- DropForeignKey
ALTER TABLE "story" DROP CONSTRAINT "story_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "story" DROP CONSTRAINT "story_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "story_app_state" DROP CONSTRAINT "story_app_state_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "story_app_state" DROP CONSTRAINT "story_app_state_updated_by_user_id_fk";

-- DropForeignKey
ALTER TABLE "story_app_state" DROP CONSTRAINT "story_app_state_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "story_bundle" DROP CONSTRAINT "story_bundle_story_version_id_story_version_id_fk";

-- DropForeignKey
ALTER TABLE "story_data_cache" DROP CONSTRAINT "story_data_cache_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "story_delivery" DROP CONSTRAINT "story_delivery_created_by_user_id_fk";

-- DropForeignKey
ALTER TABLE "story_delivery" DROP CONSTRAINT "story_delivery_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "story_delivery" DROP CONSTRAINT "story_delivery_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "story_draft_file" DROP CONSTRAINT "story_draft_file_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "story_feedback" DROP CONSTRAINT "story_feedback_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "story_feedback" DROP CONSTRAINT "story_feedback_user_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "story_file" DROP CONSTRAINT "story_file_content_hash_story_file_blob_content_hash_fk";

-- DropForeignKey
ALTER TABLE "story_file" DROP CONSTRAINT "story_file_story_version_id_story_version_id_fk";

-- DropForeignKey
ALTER TABLE "story_folder" DROP CONSTRAINT "story_folder_owner_id_user_id_fk";

-- DropForeignKey
ALTER TABLE "story_folder" DROP CONSTRAINT "story_folder_parent_id_story_folder_id_fk";

-- DropForeignKey
ALTER TABLE "story_folder" DROP CONSTRAINT "story_folder_project_id_project_id_fk";

-- DropForeignKey
ALTER TABLE "story_folder_item" DROP CONSTRAINT "story_folder_item_folder_id_story_folder_id_fk";

-- DropForeignKey
ALTER TABLE "story_folder_item" DROP CONSTRAINT "story_folder_item_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "story_version" DROP CONSTRAINT "story_version_story_id_story_id_fk";

-- DropForeignKey
ALTER TABLE "warehouse_connection_check" DROP CONSTRAINT "warehouse_connection_check_user_id_user_id_fk";

-- AlterTable
ALTER TABLE "project" DROP COLUMN "disabled_mcp_servers",
DROP COLUMN "disabled_mcp_tools",
DROP COLUMN "discord_settings",
DROP COLUMN "enabled_tools",
DROP COLUMN "known_mcp_servers",
DROP COLUMN "mattermost_settings",
DROP COLUMN "mcp_endpoint_settings",
DROP COLUMN "row_security",
DROP COLUMN "slack_settings",
DROP COLUMN "teams_settings",
DROP COLUMN "telegram_settings",
DROP COLUMN "whatsapp_settings";

-- DropTable
DROP TABLE "budget_notification";

-- DropTable
DROP TABLE "context_recommendation";

-- DropTable
DROP TABLE "context_recommendation_config";

-- DropTable
DROP TABLE "context_recommendation_linked_feedback";

-- DropTable
DROP TABLE "context_recommendation_run";

-- DropTable
DROP TABLE "favorite";

-- DropTable
DROP TABLE "mcp_call_log";

-- DropTable
DROP TABLE "mcp_chart_embed";

-- DropTable
DROP TABLE "mcp_map_embed";

-- DropTable
DROP TABLE "mcp_oauth_client";

-- DropTable
DROP TABLE "mcp_query_data";

-- DropTable
DROP TABLE "mcp_user_token";

-- DropTable
DROP TABLE "project_discord_link";

-- DropTable
DROP TABLE "project_group_budget";

-- DropTable
DROP TABLE "project_provider_budget";

-- DropTable
DROP TABLE "project_query_tool";

-- DropTable
DROP TABLE "project_story_theme";

-- DropTable
DROP TABLE "project_warehouse_credentials";

-- DropTable
DROP TABLE "project_whatsapp_link";

-- DropTable
DROP TABLE "sandbox_secret";

-- DropTable
DROP TABLE "shared_story";

-- DropTable
DROP TABLE "shared_story_access";

-- DropTable
DROP TABLE "shared_story_group_access";

-- DropTable
DROP TABLE "story";

-- DropTable
DROP TABLE "story_app_state";

-- DropTable
DROP TABLE "story_bundle";

-- DropTable
DROP TABLE "story_data_cache";

-- DropTable
DROP TABLE "story_delivery";

-- DropTable
DROP TABLE "story_draft_file";

-- DropTable
DROP TABLE "story_feedback";

-- DropTable
DROP TABLE "story_file";

-- DropTable
DROP TABLE "story_file_blob";

-- DropTable
DROP TABLE "story_folder";

-- DropTable
DROP TABLE "story_folder_item";

-- DropTable
DROP TABLE "story_version";

-- DropTable
DROP TABLE "warehouse_connection_check";
