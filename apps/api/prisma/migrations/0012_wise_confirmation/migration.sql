-- Wise confirmations (DESIGN.md §7.1): the audit log records when an action came from a confirmed Wise card, the
-- encounter carries a version a card confirms against (a stale draft is refused), and each card's outcome is kept once,
-- so a card can't be confirmed twice.

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "origin" JSONB;

-- AlterTable
ALTER TABLE "encounter" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "wise_proposal_outcome" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wise_proposal_outcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wise_proposal_outcome_tool_call_id_unique" ON "wise_proposal_outcome"("tool_call_id");

-- CreateIndex
CREATE INDEX "wise_proposal_outcome_chat_id_idx" ON "wise_proposal_outcome"("chat_id");


-- The version moves on every update, whoever makes it, so a check against it can't be skipped by another writer.
CREATE FUNCTION "bump_row_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "encounter_version"
    BEFORE UPDATE ON "encounter"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();

ALTER TABLE "wise_proposal_outcome" ADD CONSTRAINT "wise_proposal_outcome_status_check"
    CHECK ("status" IN ('confirmed', 'cancelled'));

CREATE TRIGGER "wise_proposal_outcome_append_only"
    BEFORE UPDATE OR DELETE ON "wise_proposal_outcome"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

-- As 0006 for the audit log: a user writes and reads only their own outcomes.
GRANT SELECT, INSERT ON "wise_proposal_outcome" TO loopwise_app;
ALTER TABLE "wise_proposal_outcome" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wise_proposal_outcome_own" ON "wise_proposal_outcome" TO loopwise_app
    USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
