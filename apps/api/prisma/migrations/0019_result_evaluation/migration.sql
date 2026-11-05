-- Rules engine evaluations (DESIGN.md §4.2 "actionable? urgency?", §4.3 step 3): why a result is normal, actionable or
-- critical, by which pathway rule and version. New table and enum only; nothing existing changes. Written by system
-- work (the `result.received` subscriber, the seed), append-only like `audit_log`, and readable by exactly the users
-- who can read the result: the policy looks the result up under the result's own row-level security.

CREATE TYPE "result_classification" AS ENUM ('normal', 'actionable', 'critical');

CREATE TABLE "result_evaluation" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "pathway_key" TEXT NOT NULL,
    "rule_version" INTEGER NOT NULL,
    "classification" "result_classification" NOT NULL,
    "urgency" "urgency" NOT NULL,
    "reason" TEXT NOT NULL,
    "guideline" TEXT NOT NULL,
    "next_state" "case_state" NOT NULL,
    "sla_hours" DOUBLE PRECISION,
    "basis" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "evaluated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "result_evaluation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "result_evaluation_basis_check" CHECK ("basis" IN ('band', 'critical_flag', 'unrecognised'))
);

-- One evaluation per result and rule version: a re-delivered event stores nothing new; a new pathway version adds a row.
CREATE UNIQUE INDEX "result_evaluation_result_rule_unique"
    ON "result_evaluation"("result_id", "pathway_key", "rule_version");
CREATE INDEX "result_evaluation_resultId_evaluatedAt_idx" ON "result_evaluation"("result_id", "evaluated_at");

ALTER TABLE "result_evaluation" ADD CONSTRAINT "result_evaluation_result_id_result_id_fk"
    FOREIGN KEY ("result_id") REFERENCES "result"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "result_evaluation" ADD CONSTRAINT "result_evaluation_pathway_key_pathway_key_fk"
    FOREIGN KEY ("pathway_key") REFERENCES "pathway"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "result_evaluation_append_only"
    BEFORE UPDATE OR DELETE ON "result_evaluation"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

ALTER TABLE "result_evaluation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "result_evaluation_read" ON "result_evaluation" FOR SELECT TO loopwise_app
    USING (EXISTS (SELECT 1 FROM "result" r WHERE r.id = result_id));
GRANT SELECT ON "result_evaluation" TO loopwise_app;
