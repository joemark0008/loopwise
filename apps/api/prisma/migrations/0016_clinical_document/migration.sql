-- Documents saved to a patient's chart (DESIGN.md §7.2): a Wise report version the clinician saved from the report
-- panel, frozen with the tool results it embeds. New table only; nothing existing changes. Append-only like
-- `audit_log`, and readable or writable only through the patient (row-level security, as 0011's clinical tables).

CREATE TABLE "clinical_document" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'wise_report',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "source_chat_id" TEXT NOT NULL,
    "source_tool_call_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinical_document_source_tool_call_id_unique" ON "clinical_document"("source_tool_call_id");
CREATE INDEX "clinical_document_patientId_createdAt_idx" ON "clinical_document"("patient_id", "created_at");

ALTER TABLE "clinical_document" ADD CONSTRAINT "clinical_document_patient_id_patient_id_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "clinical_document" ADD CONSTRAINT "clinical_document_created_by_id_user_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE TRIGGER "clinical_document_append_only"
    BEFORE UPDATE OR DELETE ON "clinical_document"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

ALTER TABLE "clinical_document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinical_document_access" ON "clinical_document" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND created_by_id = app_user_id());
GRANT SELECT, INSERT ON "clinical_document" TO loopwise_app;
