-- HL7 v2 ingest log (DESIGN.md §6.3, §11): every message a facility key posts to /api/hl7/messages, with the ACK it
-- got. Unique per (org, MSH-10), so a resend returns the same ACK and stores nothing twice. Unmatched messages stay
-- here (status `error`) for review. New table and type only; nothing existing changes.
--
-- System data, like `api_key`: no grant to loopwise_app, so users never read raw messages through the app role.

CREATE TYPE "hl7_message_status" AS ENUM ('accepted', 'error', 'rejected');

CREATE TABLE "hl7_message" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "control_id" TEXT,
    "message_type" TEXT,
    "raw" TEXT NOT NULL,
    "status" "hl7_message_status" NOT NULL,
    "ack_code" TEXT NOT NULL,
    "ack" TEXT NOT NULL,
    "error" TEXT,
    "patient_id" TEXT,
    "result_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "received_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hl7_message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hl7_message_org_control_id_unique" ON "hl7_message"("org_id", "control_id");
CREATE INDEX "hl7_message_status_receivedAt_idx" ON "hl7_message"("status", "received_at");

ALTER TABLE "hl7_message" ADD CONSTRAINT "hl7_message_org_id_organization_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "hl7_message" ADD CONSTRAINT "hl7_message_patient_id_patient_id_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
