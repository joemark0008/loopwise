-- Wise tool settings (DESIGN.md §9.4): a facility's admin turns Wise tools on or off, and a user can turn tools off for
-- themselves. New table only; nothing existing changes. Not clinical data: no patient, no row-level security; the API
-- reads and writes it for org admins and for the user's own rows only.

CREATE TABLE "wise_tool_setting" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "user_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wise_tool_setting_pkey" PRIMARY KEY ("id"),
    -- Either a facility's setting or a user's own, never both.
    CONSTRAINT "wise_tool_setting_owner_check" CHECK (("org_id" IS NULL) <> ("user_id" IS NULL))
);

CREATE UNIQUE INDEX "wise_tool_setting_org_tool_unique" ON "wise_tool_setting"("org_id", "tool_name")
    WHERE "org_id" IS NOT NULL;
CREATE UNIQUE INDEX "wise_tool_setting_user_tool_unique" ON "wise_tool_setting"("user_id", "tool_name")
    WHERE "user_id" IS NOT NULL;
CREATE INDEX "wise_tool_setting_orgId_idx" ON "wise_tool_setting"("org_id");
CREATE INDEX "wise_tool_setting_userId_idx" ON "wise_tool_setting"("user_id");

ALTER TABLE "wise_tool_setting" ADD CONSTRAINT "wise_tool_setting_org_id_organization_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "wise_tool_setting" ADD CONSTRAINT "wise_tool_setting_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "wise_tool_setting" ADD CONSTRAINT "wise_tool_setting_updated_by_id_user_id_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
