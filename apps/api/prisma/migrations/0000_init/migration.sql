-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(6),
    "refresh_token_expires_at" TIMESTAMP(6),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "trigger" TEXT NOT NULL DEFAULT 'system',
    "story_id" TEXT,
    "chat_id" TEXT,
    "shared_story_id" TEXT,
    "shared_chat_id" TEXT,
    "payload" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_event" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "asset_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "chat_id" TEXT,
    "story_id" TEXT,
    "shared_chat_id" TEXT,
    "shared_story_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "schedule_description" TEXT,
    "timezone" TEXT,
    "model_provider" TEXT,
    "model_id" TEXT,
    "mcp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "mcp_servers" JSONB,
    "integrations" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhook_enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_run" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "error_message" TEXT,
    "integration_results" JSONB NOT NULL DEFAULT '[]',
    "read_at" TIMESTAMP(6),

    CONSTRAINT "automation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_notification" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "period_start" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_image" (
    "id" TEXT NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slack_thread_id" TEXT,
    "project_id" TEXT NOT NULL,
    "teams_thread_id" TEXT,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "telegram_thread_id" TEXT,
    "whatsapp_thread_id" TEXT,
    "deleted_at" TIMESTAMP(6),
    "fork_metadata" JSONB,
    "mattermost_thread_id" TEXT,
    "discord_thread_id" TEXT,

    CONSTRAINT "chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stop_reason" TEXT,
    "error_message" TEXT,
    "llm_provider" TEXT,
    "llm_model_id" TEXT,
    "input_total_tokens" INTEGER,
    "input_no_cache_tokens" INTEGER,
    "input_cache_read_tokens" INTEGER,
    "input_cache_write_tokens" INTEGER,
    "output_total_tokens" INTEGER,
    "output_text_tokens" INTEGER,
    "output_reasoning_tokens" INTEGER,
    "total_tokens" INTEGER,
    "superseded_at" TIMESTAMP(6),
    "source" TEXT,
    "isForked" BOOLEAN,
    "citation" JSONB,
    "version_group_id" TEXT,
    "sender_user_id" TEXT,
    "discord_message_id" TEXT,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_branch_ownership" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_request_url" TEXT,
    "review_request_kind" TEXT,

    CONSTRAINT "context_branch_ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_recommendation" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "suggested_file" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "impact_score" INTEGER NOT NULL DEFAULT 0,
    "impact" JSONB,
    "insights" JSONB NOT NULL DEFAULT '[]',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "fix_kind" TEXT,
    "proposed_edits" JSONB,
    "fix_guidance" TEXT,
    "fix_prompt" TEXT,
    "pr_url" TEXT,
    "pr_branch" TEXT,
    "pr_created_at" TIMESTAMP(6),
    "llm_provider" TEXT,
    "llm_model_id" TEXT,
    "first_seen_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "status_changed_at" TIMESTAMP(6),
    "status_changed_by" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fix_target" TEXT,
    "category" TEXT,
    "root_cause" TEXT,
    "root_cause_kind" TEXT,

    CONSTRAINT "context_recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "context_recommendation_config" (
    "project_id" TEXT NOT NULL,
    "frequency" TEXT,
    "custom_system_prompt_instructions" TEXT,
    "repo_full_name" TEXT,
    "auto_create_prs" BOOLEAN,
    "max_auto_prs_per_run" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repo_provider" TEXT,

    CONSTRAINT "context_recommendation_config_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "context_recommendation_linked_feedback" (
    "recommendation_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "context_recommendation_linked_feedback_recommendation_id_messag" PRIMARY KEY ("recommendation_id","message_id")
);

-- CreateTable
CREATE TABLE "context_recommendation_run" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'schedule',
    "status" TEXT NOT NULL DEFAULT 'running',
    "window_start" TIMESTAMP(6),
    "window_end" TIMESTAMP(6),
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "error_message" TEXT,
    "llm_provider" TEXT,
    "llm_model_id" TEXT,
    "input_total_tokens" INTEGER,
    "output_total_tokens" INTEGER,
    "total_tokens" INTEGER,

    CONSTRAINT "context_recommendation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "story_id" TEXT,
    "folder_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jwks" (
    "id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),

    CONSTRAINT "jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyed_lock" (
    "key" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "keyed_lock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "llm_inference" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "type" TEXT NOT NULL,
    "llm_provider" TEXT NOT NULL,
    "llm_model_id" TEXT NOT NULL,
    "input_total_tokens" INTEGER,
    "input_no_cache_tokens" INTEGER,
    "input_cache_read_tokens" INTEGER,
    "input_cache_write_tokens" INTEGER,
    "output_total_tokens" INTEGER,
    "output_text_tokens" INTEGER,
    "output_reasoning_tokens" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_inference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "source" TEXT NOT NULL,
    "project_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_call_log" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "success" BOOLEAN NOT NULL,
    "tool_input" JSONB,
    "tool_output" JSONB,
    "called_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_call_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_chart_embed" (
    "chart_embed_id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "chart_config" JSONB NOT NULL,
    "source_chat_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_chart_embed_pkey" PRIMARY KEY ("chart_embed_id")
);

-- CreateTable
CREATE TABLE "mcp_map_embed" (
    "map_embed_id" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "map_config" JSONB NOT NULL,
    "source_chat_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_map_embed_pkey" PRIMARY KEY ("map_embed_id")
);

-- CreateTable
CREATE TABLE "mcp_oauth_client" (
    "project_id" TEXT NOT NULL,
    "server_name" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT,
    "client_data" TEXT,
    "discovery_user_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_oauth_client_project_id_server_name_pk" PRIMARY KEY ("project_id","server_name")
);

-- CreateTable
CREATE TABLE "mcp_query_data" (
    "query_id" TEXT NOT NULL,
    "call_log_id" TEXT,
    "project_id" TEXT NOT NULL,
    "source_chat_id" TEXT,
    "columns" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_query_data_pkey" PRIMARY KEY ("query_id")
);

-- CreateTable
CREATE TABLE "mcp_user_token" (
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "server_name" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(6),
    "scope" TEXT,
    "code_verifier" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_user_token_user_id_project_id_server_name_pk" PRIMARY KEY ("user_id","project_id","server_name")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chat_id" TEXT,
    "superseded_by" TEXT,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_feedback" (
    "message_id" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "message_image" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_part" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "text" TEXT,
    "reasoning_text" TEXT,
    "tool_call_id" TEXT,
    "tool_name" TEXT,
    "tool_state" TEXT,
    "tool_error_text" TEXT,
    "tool_input" JSONB,
    "tool_output" JSONB,
    "tool_approval_id" TEXT,
    "tool_approval_approved" BOOLEAN,
    "tool_approval_reason" TEXT,
    "tool_raw_input" JSONB,
    "tool_provider_metadata" JSONB,
    "provider_metadata" JSONB,
    "media_type" TEXT,
    "image_id" TEXT,
    "storage_path" TEXT,
    "filename" TEXT,

    CONSTRAINT "message_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link_url" TEXT,
    "payload" JSONB,
    "read_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_unsubscribe" (
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_unsubscribe_user_id_scope_pk" PRIMARY KEY ("user_id","scope")
);

-- CreateTable
CREATE TABLE "oauth_access_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "session_id" TEXT,
    "user_id" TEXT,
    "reference_id" TEXT,
    "refresh_id" TEXT,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scopes" JSONB NOT NULL,

    CONSTRAINT "oauth_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_client" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT,
    "disabled" BOOLEAN DEFAULT false,
    "skip_consent" BOOLEAN,
    "enable_end_session" BOOLEAN,
    "subject_type" TEXT,
    "scopes" JSONB,
    "user_id" TEXT,
    "name" TEXT,
    "uri" TEXT,
    "icon" TEXT,
    "contacts" JSONB,
    "tos" TEXT,
    "policy" TEXT,
    "software_id" TEXT,
    "software_version" TEXT,
    "software_statement" TEXT,
    "redirect_uris" JSONB NOT NULL,
    "post_logout_redirect_uris" JSONB,
    "token_endpoint_auth_method" TEXT,
    "grant_types" JSONB,
    "response_types" JSONB,
    "public" BOOLEAN,
    "type" TEXT,
    "require_pkce" BOOLEAN,
    "reference_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_consent" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT,
    "reference_id" TEXT,
    "scopes" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_refresh_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "session_id" TEXT,
    "user_id" TEXT NOT NULL,
    "reference_id" TEXT,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" TIMESTAMP(6),
    "auth_time" TIMESTAMP(6),
    "scopes" JSONB NOT NULL,

    CONSTRAINT "oauth_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_member" (
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_member_org_id_user_id_pk" PRIMARY KEY ("org_id","user_id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "google_client_id" TEXT,
    "google_client_secret" TEXT,
    "google_auth_domains" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "org_id" TEXT,
    "agent_settings" JSONB,
    "enabled_tools" JSONB NOT NULL DEFAULT '[]',
    "known_mcp_servers" JSONB NOT NULL DEFAULT '[]',
    "slack_settings" JSONB,
    "teams_settings" JSONB,
    "telegram_settings" JSONB,
    "whatsapp_settings" JSONB,
    "env_vars" JSONB NOT NULL DEFAULT '{}',
    "mcp_endpoint_settings" JSONB,
    "display_settings" JSONB,
    "disabled_mcp_servers" JSONB NOT NULL DEFAULT '[]',
    "disabled_mcp_tools" JSONB NOT NULL DEFAULT '[]',
    "map_settings" JSONB,
    "default_models" JSONB,
    "mattermost_settings" JSONB,
    "row_security" JSONB,
    "discord_settings" JSONB,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_discord_link" (
    "project_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_discord_link_project_id_discord_user_id_pk" PRIMARY KEY ("project_id","discord_user_id")
);

-- CreateTable
CREATE TABLE "project_group_budget" (
    "group_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "limit_usd" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_group_budget_pkey" PRIMARY KEY ("group_id")
);

-- CreateTable
CREATE TABLE "project_llm_config" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled_models" JSONB NOT NULL DEFAULT '[]',
    "base_url" TEXT,
    "credentials" JSONB,
    "custom_models" JSONB NOT NULL DEFAULT '[]',
    "model_settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "project_llm_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member" (
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_project_id_user_id_pk" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "project_provider_budget" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "limit_usd" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "current_period_start" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "per_user_limit_usd" INTEGER,

    CONSTRAINT "project_provider_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_saved_prompt" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_saved_prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_story_theme" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "theme" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generation" JSONB,

    CONSTRAINT "project_story_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_warehouse_credentials" (
    "project_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_credentials" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_warehouse_credentials_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "project_whatsapp_link" (
    "project_id" TEXT NOT NULL,
    "whatsapp_user_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_whatsapp_link_project_id_whatsapp_user_id_pk" PRIMARY KEY ("project_id","whatsapp_user_id")
);

-- CreateTable
CREATE TABLE "sandbox_secret" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sandbox_secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_chat" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'project',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_chat_access" (
    "shared_chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "shared_chat_access_shared_chat_id_user_id_pk" PRIMARY KEY ("shared_chat_id","user_id")
);

-- CreateTable
CREATE TABLE "shared_story" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'project',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "shared_story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_story_access" (
    "shared_story_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "shared_story_access_shared_story_id_user_id_pk" PRIMARY KEY ("shared_story_id","user_id")
);

-- CreateTable
CREATE TABLE "shared_story_group_access" (
    "shared_story_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "shared_story_group_access_shared_story_id_group_id_pk" PRIMARY KEY ("shared_story_id","group_id")
);

-- CreateTable
CREATE TABLE "story" (
    "id" TEXT NOT NULL,
    "chat_id" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "is_live_text_dynamic" BOOLEAN NOT NULL DEFAULT true,
    "cache_schedule" TEXT,
    "cache_schedule_description" TEXT,
    "archived_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_id" TEXT,
    "user_id" TEXT,
    "certified_at" TIMESTAMP(6),
    "certified_by" TEXT,
    "format" TEXT NOT NULL DEFAULT 'classic',

    CONSTRAINT "story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_app_state" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "user_id" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_app_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_bundle" (
    "story_version_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bundle" TEXT,
    "page_shell" TEXT,
    "bundle_error" TEXT,
    "built_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thumbnail" TEXT,
    "thumbnail_theme" TEXT,

    CONSTRAINT "story_bundle_pkey" PRIMARY KEY ("story_version_id")
);

-- CreateTable
CREATE TABLE "story_data_cache" (
    "story_id" TEXT NOT NULL,
    "query_data" JSONB NOT NULL,
    "analysis_results" JSONB,
    "cached_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "query_sources" JSONB,

    CONSTRAINT "story_data_cache_pkey" PRIMARY KEY ("story_id")
);

-- CreateTable
CREATE TABLE "story_delivery" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "project_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "cron" TEXT,
    "schedule_description" TEXT,
    "channels" JSONB NOT NULL,
    "recipient_mode" TEXT NOT NULL DEFAULT 'specific',
    "recipient_user_ids" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_group_ids" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "story_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_draft_file" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_draft_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_feedback" (
    "story_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_feedback_story_id_user_id_pk" PRIMARY KEY ("story_id","user_id")
);

-- CreateTable
CREATE TABLE "story_file" (
    "id" TEXT NOT NULL,
    "story_version_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_file_blob" (
    "content_hash" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_file_blob_pkey" PRIMARY KEY ("content_hash")
);

-- CreateTable
CREATE TABLE "story_folder" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "system_type" TEXT,
    "archived_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_folder_item" (
    "story_id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,

    CONSTRAINT "story_folder_item_pkey" PRIMARY KEY ("story_id")
);

-- CreateTable
CREATE TABLE "story_version" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requires_password_reset" BOOLEAN NOT NULL DEFAULT false,
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "messaging_provider_code" TEXT,
    "github_access_token" TEXT,
    "gitlab_access_token" TEXT,
    "deactivated_at" TIMESTAMP(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "feature_grants" JSONB NOT NULL DEFAULT '{"version": 2, "features": [], "toolCallDensity": {"canChange": true, "defaultDensity": "detailed"}}',
    "context_grants" JSONB,
    "row_policies" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_member" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_member_group_id_user_id_provider_pk" PRIMARY KEY ("group_id","user_id","provider")
);

-- CreateTable
CREATE TABLE "user_preference" (
    "user_id" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preference_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_connection_check" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_connection_check_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "activity_chatId_idx" ON "activity"("chat_id");

-- CreateIndex
CREATE INDEX "activity_projectId_idx" ON "activity"("project_id");

-- CreateIndex
CREATE INDEX "activity_sharedChatId_idx" ON "activity"("shared_chat_id");

-- CreateIndex
CREATE INDEX "activity_sharedStoryId_idx" ON "activity"("shared_story_id");

-- CreateIndex
CREATE INDEX "activity_startedAt_idx" ON "activity"("started_at");

-- CreateIndex
CREATE INDEX "activity_storyId_idx" ON "activity"("story_id");

-- CreateIndex
CREATE INDEX "activity_type_idx" ON "activity"("type");

-- CreateIndex
CREATE INDEX "activity_userId_idx" ON "activity"("user_id");

-- CreateIndex
CREATE INDEX "analytics_event_actorUserId_idx" ON "analytics_event"("actor_user_id");

-- CreateIndex
CREATE INDEX "analytics_event_chatId_idx" ON "analytics_event"("chat_id");

-- CreateIndex
CREATE INDEX "analytics_event_projectId_idx" ON "analytics_event"("project_id");

-- CreateIndex
CREATE INDEX "analytics_event_project_type_asset_story_idx" ON "analytics_event"("project_id", "type", "asset_type", "story_id");

-- CreateIndex
CREATE INDEX "analytics_event_sharedChatId_idx" ON "analytics_event"("shared_chat_id");

-- CreateIndex
CREATE INDEX "analytics_event_sharedStoryId_idx" ON "analytics_event"("shared_story_id");

-- CreateIndex
CREATE INDEX "analytics_event_storyId_idx" ON "analytics_event"("story_id");

-- CreateIndex
CREATE INDEX "analytics_event_type_createdAt_idx" ON "analytics_event"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_hash_unique" ON "api_key"("key_hash");

-- CreateIndex
CREATE INDEX "api_key_orgId_idx" ON "api_key"("org_id");

-- CreateIndex
CREATE INDEX "automation_projectId_idx" ON "automation"("project_id");

-- CreateIndex
CREATE INDEX "automation_userId_idx" ON "automation"("user_id");

-- CreateIndex
CREATE INDEX "automation_run_automationId_idx" ON "automation_run"("automation_id");

-- CreateIndex
CREATE INDEX "automation_run_chatId_idx" ON "automation_run"("chat_id");

-- CreateIndex
CREATE INDEX "automation_run_status_idx" ON "automation_run"("status");

-- CreateIndex
CREATE INDEX "budget_notification_projectId_idx" ON "budget_notification"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_notification_project_provider_scope_period" ON "budget_notification"("project_id", "provider", "scope", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "chart_image_tool_call_id_unique" ON "chart_image"("tool_call_id");

-- CreateIndex
CREATE INDEX "chat_discord_thread_idx" ON "chat"("discord_thread_id");

-- CreateIndex
CREATE INDEX "chat_mattermost_thread_idx" ON "chat"("mattermost_thread_id");

-- CreateIndex
CREATE INDEX "chat_projectId_idx" ON "chat"("project_id");

-- CreateIndex
CREATE INDEX "chat_slack_thread_idx" ON "chat"("slack_thread_id");

-- CreateIndex
CREATE INDEX "chat_teams_thread_idx" ON "chat"("teams_thread_id");

-- CreateIndex
CREATE INDEX "chat_telegram_thread_idx" ON "chat"("telegram_thread_id");

-- CreateIndex
CREATE INDEX "chat_userId_idx" ON "chat"("user_id");

-- CreateIndex
CREATE INDEX "chat_whatsapp_thread_idx" ON "chat"("whatsapp_thread_id");

-- CreateIndex
CREATE INDEX "chat_message_chatId_createdAt_idx" ON "chat_message"("chat_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_message_chatId_idx" ON "chat_message"("chat_id");

-- CreateIndex
CREATE INDEX "chat_message_createdAt_idx" ON "chat_message"("created_at");

-- CreateIndex
CREATE INDEX "chat_message_discordMessageId_idx" ON "chat_message"("discord_message_id");

-- CreateIndex
CREATE INDEX "chat_message_senderUserId_idx" ON "chat_message"("sender_user_id");

-- CreateIndex
CREATE INDEX "chat_message_versionGroupId_idx" ON "chat_message"("version_group_id");

-- CreateIndex
CREATE INDEX "context_branch_ownership_userId_idx" ON "context_branch_ownership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "context_branch_ownership_project_branch_unique" ON "context_branch_ownership"("project_id", "branch");

-- CreateIndex
CREATE INDEX "context_recommendation_projectId_status_idx" ON "context_recommendation"("project_id", "status");

-- CreateIndex
CREATE INDEX "context_recommendation_runId_idx" ON "context_recommendation"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "context_recommendation_project_fingerprint_unique" ON "context_recommendation"("project_id", "fingerprint");

-- CreateIndex
CREATE INDEX "context_recommendation_linked_feedback_message_id_idx" ON "context_recommendation_linked_feedback"("message_id");

-- CreateIndex
CREATE INDEX "context_recommendation_run_chatId_idx" ON "context_recommendation_run"("chat_id");

-- CreateIndex
CREATE INDEX "context_recommendation_run_projectId_idx" ON "context_recommendation_run"("project_id");

-- CreateIndex
CREATE INDEX "context_recommendation_run_status_idx" ON "context_recommendation_run"("status");

-- CreateIndex
CREATE UNIQUE INDEX "context_recommendation_run_id_project_unique" ON "context_recommendation_run"("id", "project_id");

-- CreateIndex
CREATE INDEX "favorite_user_id_idx" ON "favorite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_user_id_folder_id_unique" ON "favorite"("user_id", "folder_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_user_id_story_id_unique" ON "favorite"("user_id", "story_id");

-- CreateIndex
CREATE INDEX "llm_inference_createdAt_idx" ON "llm_inference"("created_at");

-- CreateIndex
CREATE INDEX "llm_inference_projectId_idx" ON "llm_inference"("project_id");

-- CreateIndex
CREATE INDEX "llm_inference_type_idx" ON "llm_inference"("type");

-- CreateIndex
CREATE INDEX "llm_inference_userId_idx" ON "llm_inference"("user_id");

-- CreateIndex
CREATE INDEX "log_createdAt_idx" ON "log"("created_at");

-- CreateIndex
CREATE INDEX "log_level_idx" ON "log"("level");

-- CreateIndex
CREATE INDEX "log_projectId_idx" ON "log"("project_id");

-- CreateIndex
CREATE INDEX "mcp_call_log_calledAt_idx" ON "mcp_call_log"("called_at");

-- CreateIndex
CREATE INDEX "mcp_call_log_projectId_idx" ON "mcp_call_log"("project_id");

-- CreateIndex
CREATE INDEX "mcp_call_log_userId_idx" ON "mcp_call_log"("user_id");

-- CreateIndex
CREATE INDEX "mcp_chart_embed_query_id_idx" ON "mcp_chart_embed"("query_id");

-- CreateIndex
CREATE INDEX "mcp_map_embed_query_id_idx" ON "mcp_map_embed"("query_id");

-- CreateIndex
CREATE INDEX "mcp_query_data_callLogId_idx" ON "mcp_query_data"("call_log_id");

-- CreateIndex
CREATE INDEX "mcp_query_data_project_id_idx" ON "mcp_query_data"("project_id");

-- CreateIndex
CREATE INDEX "mcp_user_token_project_server_idx" ON "mcp_user_token"("project_id", "server_name");

-- CreateIndex
CREATE INDEX "memories_chatId_idx" ON "memories"("chat_id");

-- CreateIndex
CREATE INDEX "memories_supersededBy_idx" ON "memories"("superseded_by");

-- CreateIndex
CREATE INDEX "memories_userId_idx" ON "memories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_part_tool_call_id_unique" ON "message_part"("tool_call_id");

-- CreateIndex
CREATE INDEX "parts_message_id_idx" ON "message_part"("message_id");

-- CreateIndex
CREATE INDEX "parts_message_id_order_idx" ON "message_part"("message_id", "order");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "notification"("created_at");

-- CreateIndex
CREATE INDEX "notification_user_project_read_idx" ON "notification"("user_id", "project_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_user_read_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_unsubscribe_scope_idx" ON "notification_unsubscribe"("scope");

-- CreateIndex
CREATE INDEX "notification_unsubscribe_userId_idx" ON "notification_unsubscribe"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_token_token_unique" ON "oauth_access_token"("token");

-- CreateIndex
CREATE INDEX "oauth_access_token_clientId_idx" ON "oauth_access_token"("client_id");

-- CreateIndex
CREATE INDEX "oauth_access_token_refreshId_idx" ON "oauth_access_token"("refresh_id");

-- CreateIndex
CREATE INDEX "oauth_access_token_userId_idx" ON "oauth_access_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_client_client_id_unique" ON "oauth_client"("client_id");

-- CreateIndex
CREATE INDEX "oauth_client_userId_idx" ON "oauth_client"("user_id");

-- CreateIndex
CREATE INDEX "oauth_consent_clientId_idx" ON "oauth_consent"("client_id");

-- CreateIndex
CREATE INDEX "oauth_consent_userId_idx" ON "oauth_consent"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_token_token_unique" ON "oauth_refresh_token"("token");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_clientId_idx" ON "oauth_refresh_token"("client_id");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_sessionId_idx" ON "oauth_refresh_token"("session_id");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_userId_idx" ON "oauth_refresh_token"("user_id");

-- CreateIndex
CREATE INDEX "org_member_userId_idx" ON "org_member"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_unique" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "project_orgId_idx" ON "project"("org_id");

-- CreateIndex
CREATE INDEX "project_discord_link_userId_idx" ON "project_discord_link"("user_id");

-- CreateIndex
CREATE INDEX "project_group_budget_projectId_idx" ON "project_group_budget"("project_id");

-- CreateIndex
CREATE INDEX "project_llm_config_projectId_idx" ON "project_llm_config"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_llm_config_project_provider" ON "project_llm_config"("project_id", "provider");

-- CreateIndex
CREATE INDEX "project_member_userId_idx" ON "project_member"("user_id");

-- CreateIndex
CREATE INDEX "project_provider_budget_projectId_idx" ON "project_provider_budget"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_provider_budget_project_provider" ON "project_provider_budget"("project_id", "provider");

-- CreateIndex
CREATE INDEX "project_saved_prompt_projectId_idx" ON "project_saved_prompt"("project_id");

-- CreateIndex
CREATE INDEX "project_story_theme_projectId_idx" ON "project_story_theme"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_story_theme_project_version_unique" ON "project_story_theme"("project_id", "version");

-- CreateIndex
CREATE INDEX "project_whatsapp_link_userId_idx" ON "project_whatsapp_link"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sandbox_secret_user_project_name_idx" ON "sandbox_secret"("user_id", "project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_unique" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_chat_chatId_unique" ON "shared_chat"("chat_id");

-- CreateIndex
CREATE INDEX "shared_story_projectId_idx" ON "shared_story"("project_id");

-- CreateIndex
CREATE INDEX "shared_story_storyId_idx" ON "shared_story"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_story_project_story_unique" ON "shared_story"("project_id", "story_id");

-- CreateIndex
CREATE INDEX "shared_story_group_access_groupId_idx" ON "shared_story_group_access"("group_id");

-- CreateIndex
CREATE INDEX "story_chatId_idx" ON "story"("chat_id");

-- CreateIndex
CREATE INDEX "story_projectId_idx" ON "story"("project_id");

-- CreateIndex
CREATE INDEX "story_userId_idx" ON "story"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_chat_slug_unique" ON "story"("chat_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "story_standalone_slug_unique" ON "story"("project_id", "user_id", "slug") WHERE (chat_id IS NULL);

-- CreateIndex
CREATE INDEX "story_app_state_storyId_idx" ON "story_app_state"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_app_state_project_key_unique" ON "story_app_state"("story_id", "key") WHERE (scope = 'project'::text);

-- CreateIndex
CREATE UNIQUE INDEX "story_app_state_user_key_unique" ON "story_app_state"("story_id", "user_id", "key") WHERE (scope = 'user'::text);

-- CreateIndex
CREATE UNIQUE INDEX "story_delivery_story_id_unique" ON "story_delivery"("story_id");

-- CreateIndex
CREATE INDEX "story_draft_file_storyId_idx" ON "story_draft_file"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_draft_file_story_path_unique" ON "story_draft_file"("story_id", "path");

-- CreateIndex
CREATE INDEX "story_feedback_userId_idx" ON "story_feedback"("user_id");

-- CreateIndex
CREATE INDEX "story_file_storyVersionId_idx" ON "story_file"("story_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_file_version_path_unique" ON "story_file"("story_version_id", "path");

-- CreateIndex
CREATE INDEX "story_folder_ownerProjectParent_idx" ON "story_folder"("owner_id", "project_id", "parent_id");

-- CreateIndex
CREATE INDEX "story_folder_projectId_idx" ON "story_folder"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_folder_private_root_unique" ON "story_folder"("project_id", "owner_id") WHERE (system_type = 'private_folder'::text);

-- CreateIndex
CREATE INDEX "story_folder_item_folderId_idx" ON "story_folder_item"("folder_id");

-- CreateIndex
CREATE INDEX "story_version_storyId_idx" ON "story_version"("story_id");

-- CreateIndex
CREATE UNIQUE INDEX "story_version_story_version_unique" ON "story_version"("story_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_unique" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_messaging_provider_code_unique" ON "user"("messaging_provider_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_project_default_unique" ON "user_group"("project_id") WHERE (is_default = true);

-- CreateIndex
CREATE INDEX "user_group_projectId_idx" ON "user_group"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_project_name_unique" ON "user_group"("project_id", "name");

-- CreateIndex
CREATE INDEX "user_group_member_user_provider_idx" ON "user_group_member"("user_id", "provider");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "warehouse_connection_check_userId_idx" ON "warehouse_connection_check"("user_id");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_shared_chat_id_shared_chat_id_fk" FOREIGN KEY ("shared_chat_id") REFERENCES "shared_chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_shared_story_id_shared_story_id_fk" FOREIGN KEY ("shared_story_id") REFERENCES "shared_story"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_shared_chat_id_shared_chat_id_fk" FOREIGN KEY ("shared_chat_id") REFERENCES "shared_chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_shared_story_id_shared_story_id_fk" FOREIGN KEY ("shared_story_id") REFERENCES "shared_story"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "automation" ADD CONSTRAINT "automation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "automation" ADD CONSTRAINT "automation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_automation_id_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "automation"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_notification" ADD CONSTRAINT "budget_notification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_branch_ownership" ADD CONSTRAINT "context_branch_ownership_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_branch_ownership" ADD CONSTRAINT "context_branch_ownership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation" ADD CONSTRAINT "context_recommendation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation" ADD CONSTRAINT "context_recommendation_run_fk" FOREIGN KEY ("run_id", "project_id") REFERENCES "context_recommendation_run"("id", "project_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation" ADD CONSTRAINT "context_recommendation_status_changed_by_user_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation_config" ADD CONSTRAINT "context_recommendation_config_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation_linked_feedback" ADD CONSTRAINT "context_recommendation_linked_feedback_message_id_chat_message_" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation_linked_feedback" ADD CONSTRAINT "context_recommendation_linked_feedback_recommendation_id_contex" FOREIGN KEY ("recommendation_id") REFERENCES "context_recommendation"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation_run" ADD CONSTRAINT "context_recommendation_run_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "context_recommendation_run" ADD CONSTRAINT "context_recommendation_run_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_folder_id_story_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "story_folder"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "llm_inference" ADD CONSTRAINT "llm_inference_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "llm_inference" ADD CONSTRAINT "llm_inference_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "llm_inference" ADD CONSTRAINT "llm_inference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_call_log" ADD CONSTRAINT "mcp_call_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_call_log" ADD CONSTRAINT "mcp_call_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_chart_embed" ADD CONSTRAINT "mcp_chart_embed_query_id_mcp_query_data_query_id_fk" FOREIGN KEY ("query_id") REFERENCES "mcp_query_data"("query_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_map_embed" ADD CONSTRAINT "mcp_map_embed_query_id_mcp_query_data_query_id_fk" FOREIGN KEY ("query_id") REFERENCES "mcp_query_data"("query_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_oauth_client" ADD CONSTRAINT "mcp_oauth_client_discovery_user_id_user_id_fk" FOREIGN KEY ("discovery_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_oauth_client" ADD CONSTRAINT "mcp_oauth_client_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_query_data" ADD CONSTRAINT "mcp_query_data_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_user_token" ADD CONSTRAINT "mcp_user_token_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mcp_user_token" ADD CONSTRAINT "mcp_user_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_part" ADD CONSTRAINT "message_part_image_id_message_image_id_fk" FOREIGN KEY ("image_id") REFERENCES "message_image"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_part" ADD CONSTRAINT "message_part_message_id_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_unsubscribe" ADD CONSTRAINT "notification_unsubscribe_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_refresh_id_oauth_refresh_token_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "oauth_refresh_token"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_access_token" ADD CONSTRAINT "oauth_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_client" ADD CONSTRAINT "oauth_client_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_consent" ADD CONSTRAINT "oauth_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_client_id_oauth_client_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_discord_link" ADD CONSTRAINT "project_discord_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_discord_link" ADD CONSTRAINT "project_discord_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_group_budget" ADD CONSTRAINT "project_group_budget_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "user_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_group_budget" ADD CONSTRAINT "project_group_budget_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_llm_config" ADD CONSTRAINT "project_llm_config_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_provider_budget" ADD CONSTRAINT "project_provider_budget_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_saved_prompt" ADD CONSTRAINT "project_saved_prompt_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_story_theme" ADD CONSTRAINT "project_story_theme_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_warehouse_credentials" ADD CONSTRAINT "project_warehouse_credentials_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_whatsapp_link" ADD CONSTRAINT "project_whatsapp_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_whatsapp_link" ADD CONSTRAINT "project_whatsapp_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sandbox_secret" ADD CONSTRAINT "sandbox_secret_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sandbox_secret" ADD CONSTRAINT "sandbox_secret_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_chat" ADD CONSTRAINT "shared_chat_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_chat_access" ADD CONSTRAINT "shared_chat_access_shared_chat_id_shared_chat_id_fk" FOREIGN KEY ("shared_chat_id") REFERENCES "shared_chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_chat_access" ADD CONSTRAINT "shared_chat_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story" ADD CONSTRAINT "shared_story_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story" ADD CONSTRAINT "shared_story_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story" ADD CONSTRAINT "shared_story_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story_access" ADD CONSTRAINT "shared_story_access_shared_story_id_shared_story_id_fk" FOREIGN KEY ("shared_story_id") REFERENCES "shared_story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story_access" ADD CONSTRAINT "shared_story_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story_group_access" ADD CONSTRAINT "shared_story_group_access_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "user_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "shared_story_group_access" ADD CONSTRAINT "shared_story_group_access_shared_story_id_shared_story_id_fk" FOREIGN KEY ("shared_story_id") REFERENCES "shared_story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "story_certified_by_user_id_fk" FOREIGN KEY ("certified_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "story_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "story_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story" ADD CONSTRAINT "story_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_app_state" ADD CONSTRAINT "story_app_state_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_app_state" ADD CONSTRAINT "story_app_state_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_app_state" ADD CONSTRAINT "story_app_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_bundle" ADD CONSTRAINT "story_bundle_story_version_id_story_version_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "story_version"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_data_cache" ADD CONSTRAINT "story_data_cache_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_delivery" ADD CONSTRAINT "story_delivery_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_delivery" ADD CONSTRAINT "story_delivery_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_delivery" ADD CONSTRAINT "story_delivery_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_draft_file" ADD CONSTRAINT "story_draft_file_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_feedback" ADD CONSTRAINT "story_feedback_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_feedback" ADD CONSTRAINT "story_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_file" ADD CONSTRAINT "story_file_content_hash_story_file_blob_content_hash_fk" FOREIGN KEY ("content_hash") REFERENCES "story_file_blob"("content_hash") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_file" ADD CONSTRAINT "story_file_story_version_id_story_version_id_fk" FOREIGN KEY ("story_version_id") REFERENCES "story_version"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_folder" ADD CONSTRAINT "story_folder_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_folder" ADD CONSTRAINT "story_folder_parent_id_story_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "story_folder"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_folder" ADD CONSTRAINT "story_folder_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_folder_item" ADD CONSTRAINT "story_folder_item_folder_id_story_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "story_folder"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_folder_item" ADD CONSTRAINT "story_folder_item_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "story_version" ADD CONSTRAINT "story_version_story_id_story_id_fk" FOREIGN KEY ("story_id") REFERENCES "story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_group" ADD CONSTRAINT "user_group_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_group_member" ADD CONSTRAINT "user_group_member_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "user_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_group_member" ADD CONSTRAINT "user_group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "warehouse_connection_check" ADD CONSTRAINT "warehouse_connection_check_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- Check constraints (not modelled by Prisma; copied from the upstream Drizzle schema)
ALTER TABLE "analytics_event" ADD CONSTRAINT "analytics_event_asset_id_required" CHECK (
CASE
    WHEN (asset_type = 'chat'::text) THEN (chat_id IS NOT NULL)
    WHEN (asset_type = 'story'::text) THEN (story_id IS NOT NULL)
    ELSE true
END);
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_xor_target" CHECK (((((story_id IS NOT NULL))::integer + ((folder_id IS NOT NULL))::integer) = 1));
ALTER TABLE "message_part" ADD CONSTRAINT "file_fields_required" CHECK (
CASE
    WHEN (type = 'file'::text) THEN ((media_type IS NOT NULL) AND ((image_id IS NOT NULL) OR (storage_path IS NOT NULL)))
    ELSE true
END);
ALTER TABLE "message_part" ADD CONSTRAINT "reasoning_text_required_if_type_is_reasoning" CHECK (
CASE
    WHEN (type = 'reasoning'::text) THEN (reasoning_text IS NOT NULL)
    ELSE true
END);
ALTER TABLE "message_part" ADD CONSTRAINT "text_required_if_type_is_text" CHECK (
CASE
    WHEN (type = 'text'::text) THEN (text IS NOT NULL)
    ELSE true
END);
ALTER TABLE "message_part" ADD CONSTRAINT "tool_call_fields_required" CHECK (
CASE
    WHEN (type ~~ 'tool-%'::text) THEN ((tool_call_id IS NOT NULL) AND (tool_state IS NOT NULL))
    ELSE true
END);
ALTER TABLE "project_provider_budget" ADD CONSTRAINT "budget_period_valid" CHECK ((period = ANY (ARRAY['day'::text, 'week'::text, 'month'::text])));
ALTER TABLE "project" ADD CONSTRAINT "local_project_path_required" CHECK (
CASE
    WHEN (type = 'local'::text) THEN (path IS NOT NULL)
    ELSE true
END);
ALTER TABLE "story_app_state" ADD CONSTRAINT "story_app_state_user_scope" CHECK (((scope = 'user'::text) = (user_id IS NOT NULL)));
ALTER TABLE "story" ADD CONSTRAINT "story_owner_required" CHECK (((chat_id IS NOT NULL) OR ((project_id IS NOT NULL) AND (user_id IS NOT NULL))));
