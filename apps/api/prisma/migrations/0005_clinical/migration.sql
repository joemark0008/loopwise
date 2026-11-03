-- CreateEnum
CREATE TYPE "organization_type" AS ENUM ('clinic', 'lab', 'imaging', 'hospital', 'pharmacy', 'program');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('female', 'male', 'other', 'unknown');

-- CreateEnum
CREATE TYPE "care_relationship_reason" AS ENUM ('encounter', 'order', 'referral', 'case_owner', 'break_glass');

-- CreateEnum
CREATE TYPE "order_priority" AS ENUM ('routine', 'urgent', 'stat');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('draft', 'sent', 'accepted', 'collected', 'resulted', 'reviewed', 'cancelled');

-- CreateEnum
CREATE TYPE "result_flag" AS ENUM ('normal', 'low', 'high', 'abnormal', 'critical_low', 'critical_high');

-- CreateEnum
CREATE TYPE "case_state" AS ENUM ('open', 'notified', 'acknowledged', 'confirming', 'referred', 'accepted', 'seen', 'treatment_started', 'closed', 'escalated', 'lost_to_follow_up');

-- CreateEnum
CREATE TYPE "urgency" AS ENUM ('routine', 'soon', 'urgent', 'critical');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('user', 'organization', 'system');

-- CreateEnum
CREATE TYPE "referral_status" AS ENUM ('sent', 'accepted', 'rejected', 'booked', 'seen', 'cancelled');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('open', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "evidence_type" AS ENUM ('result', 'visit_note', 'dispense', 'signoff');

-- CreateEnum
CREATE TYPE "message_channel" AS ENUM ('sms', 'messenger', 'secure_link', 'phone_call', 'home_visit');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('draft', 'queued', 'sent', 'delivered', 'failed', 'acknowledged', 'replied');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "type" "organization_type" NOT NULL DEFAULT 'clinic';

-- CreateTable
CREATE TABLE "patient" (
    "id" TEXT NOT NULL,
    "given_name" TEXT NOT NULL,
    "family_name" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "sex" "sex" NOT NULL,
    "phone" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "consent_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_identifier" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_relationship" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "reason" "care_relationship_reason" NOT NULL,
    "note" TEXT,
    "expires_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "started_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_order" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "ordering_doctor_id" TEXT NOT NULL,
    "ordering_org_id" TEXT NOT NULL,
    "target_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "code_system" TEXT NOT NULL DEFAULT 'LOINC',
    "display" TEXT,
    "priority" "order_priority" NOT NULL DEFAULT 'routine',
    "status" "order_status" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "sent_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "source_org_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "code_system" TEXT NOT NULL DEFAULT 'LOINC',
    "display" TEXT,
    "value" TEXT NOT NULL,
    "value_numeric" DECIMAL(18,6),
    "unit" TEXT,
    "ref_range" TEXT,
    "flag" "result_flag",
    "raw_hl7" TEXT,
    "resulted_at" TIMESTAMP(6) NOT NULL,
    "received_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(6),
    "reviewed_by_id" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pathway" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rules" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "slas" JSONB NOT NULL,
    "closure_requirements" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_case" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "pathway_id" TEXT NOT NULL,
    "trigger_result_id" TEXT,
    "state" "case_state" NOT NULL DEFAULT 'open',
    "state_before_escalation" "case_state",
    "urgency" "urgency" NOT NULL DEFAULT 'routine',
    "owner_user_id" TEXT,
    "owner_org_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(6),
    "closed_at" TIMESTAMP(6),
    "close_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_event" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "from_state" "case_state",
    "to_state" "case_state",
    "actor_type" "actor_type" NOT NULL,
    "actor_user_id" TEXT,
    "actor_org_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "from_org_id" TEXT NOT NULL,
    "to_org_id" TEXT NOT NULL,
    "to_user_id" TEXT,
    "status" "referral_status" NOT NULL DEFAULT 'sent',
    "reason" TEXT,
    "rejection_reason" TEXT,
    "appointment_at" TIMESTAMP(6),
    "responded_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_id" TEXT,
    "owner_org_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(6),
    "status" "task_status" NOT NULL DEFAULT 'open',
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "type" "evidence_type" NOT NULL,
    "ref_id" TEXT,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "recorded_by_org_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_message" (
    "id" TEXT NOT NULL,
    "case_id" TEXT,
    "patient_id" TEXT NOT NULL,
    "channel" "message_channel" NOT NULL,
    "template_key" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "message_status" NOT NULL DEFAULT 'draft',
    "created_by_id" TEXT,
    "sent_at" TIMESTAMP(6),
    "ack_at" TIMESTAMP(6),
    "reply" TEXT,
    "replied_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "org_id" TEXT,
    "action" TEXT NOT NULL,
    "patient_id" TEXT,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "reason" TEXT,
    "at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_name_birth_date_idx" ON "patient"("family_name", "given_name", "birth_date");

-- CreateIndex
CREATE INDEX "patient_identifier_patientId_idx" ON "patient_identifier"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_identifier_org_system_value_unique" ON "patient_identifier"("org_id", "system", "value");

-- CreateIndex
CREATE INDEX "care_relationship_userId_patientId_idx" ON "care_relationship"("user_id", "patient_id");

-- CreateIndex
CREATE INDEX "care_relationship_patientId_idx" ON "care_relationship"("patient_id");

-- CreateIndex
CREATE INDEX "encounter_patientId_idx" ON "encounter"("patient_id");

-- CreateIndex
CREATE INDEX "encounter_doctorId_startedAt_idx" ON "encounter"("doctor_id", "started_at");

-- CreateIndex
CREATE INDEX "clinical_order_patientId_idx" ON "clinical_order"("patient_id");

-- CreateIndex
CREATE INDEX "clinical_order_targetOrgId_status_idx" ON "clinical_order"("target_org_id", "status");

-- CreateIndex
CREATE INDEX "clinical_order_orderingDoctorId_status_idx" ON "clinical_order"("ordering_doctor_id", "status");

-- CreateIndex
CREATE INDEX "result_patientId_resultedAt_idx" ON "result"("patient_id", "resulted_at");

-- CreateIndex
CREATE INDEX "result_orderId_idx" ON "result"("order_id");

-- CreateIndex
CREATE INDEX "result_awaiting_review_idx" ON "result"("received_at") WHERE (reviewed_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "pathway_key_unique" ON "pathway"("key");

-- CreateIndex
CREATE INDEX "care_case_ownerUserId_state_dueAt_idx" ON "care_case"("owner_user_id", "state", "due_at");

-- CreateIndex
CREATE INDEX "care_case_ownerOrgId_state_idx" ON "care_case"("owner_org_id", "state");

-- CreateIndex
CREATE INDEX "care_case_patientId_idx" ON "care_case"("patient_id");

-- CreateIndex
CREATE INDEX "case_event_caseId_createdAt_idx" ON "case_event"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "referral_caseId_idx" ON "referral"("case_id");

-- CreateIndex
CREATE INDEX "referral_toOrgId_status_idx" ON "referral"("to_org_id", "status");

-- CreateIndex
CREATE INDEX "task_caseId_idx" ON "task"("case_id");

-- CreateIndex
CREATE INDEX "task_ownerUserId_status_dueAt_idx" ON "task"("owner_user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "task_ownerOrgId_status_idx" ON "task"("owner_org_id", "status");

-- CreateIndex
CREATE INDEX "evidence_caseId_idx" ON "evidence"("case_id");

-- CreateIndex
CREATE INDEX "patient_message_caseId_idx" ON "patient_message"("case_id");

-- CreateIndex
CREATE INDEX "patient_message_patientId_createdAt_idx" ON "patient_message"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_patientId_at_idx" ON "audit_log"("patient_id", "at");

-- CreateIndex
CREATE INDEX "audit_log_userId_at_idx" ON "audit_log"("user_id", "at");

-- AddForeignKey
ALTER TABLE "patient_identifier" ADD CONSTRAINT "patient_identifier_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_identifier" ADD CONSTRAINT "patient_identifier_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_relationship" ADD CONSTRAINT "care_relationship_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_relationship" ADD CONSTRAINT "care_relationship_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_relationship" ADD CONSTRAINT "care_relationship_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_doctor_id_user_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinical_order" ADD CONSTRAINT "clinical_order_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "encounter"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinical_order" ADD CONSTRAINT "clinical_order_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinical_order" ADD CONSTRAINT "clinical_order_ordering_doctor_id_user_id_fk" FOREIGN KEY ("ordering_doctor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinical_order" ADD CONSTRAINT "clinical_order_ordering_org_id_organization_id_fk" FOREIGN KEY ("ordering_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinical_order" ADD CONSTRAINT "clinical_order_target_org_id_organization_id_fk" FOREIGN KEY ("target_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "result" ADD CONSTRAINT "result_order_id_clinical_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "clinical_order"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "result" ADD CONSTRAINT "result_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "result" ADD CONSTRAINT "result_source_org_id_organization_id_fk" FOREIGN KEY ("source_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "result" ADD CONSTRAINT "result_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_pathway_id_pathway_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "pathway"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_trigger_result_id_result_id_fk" FOREIGN KEY ("trigger_result_id") REFERENCES "result"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "care_case" ADD CONSTRAINT "care_case_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_case_id_care_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_case_id_care_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_from_org_id_organization_id_fk" FOREIGN KEY ("from_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_to_org_id_organization_id_fk" FOREIGN KEY ("to_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral" ADD CONSTRAINT "referral_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_case_id_care_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_case_id_care_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_recorded_by_org_id_organization_id_fk" FOREIGN KEY ("recorded_by_org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_message" ADD CONSTRAINT "patient_message_case_id_care_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "care_case"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_message" ADD CONSTRAINT "patient_message_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_message" ADD CONSTRAINT "patient_message_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Append-only history (DESIGN.md §7, §10.6): case events and the audit log are never changed or removed.
CREATE FUNCTION "reject_append_only_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER "case_event_append_only"
    BEFORE UPDATE OR DELETE ON "case_event"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

CREATE TRIGGER "audit_log_append_only"
    BEFORE UPDATE OR DELETE ON "audit_log"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
