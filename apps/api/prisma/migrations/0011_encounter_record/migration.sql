-- The encounter record (DESIGN.md §7): the SOAP note and plan on the encounter; vitals, ICD-10 diagnoses, allergies,
-- prescriptions, medical certificates and the bill beside it; clinician profiles (PRC license) and facility addresses
-- for the documents. Row-level security follows 0006_clinical_rls; issued documents are locked by triggers.

-- CreateEnum
CREATE TYPE "diagnosis_certainty" AS ENUM ('provisional', 'confirmed');

-- CreateEnum
CREATE TYPE "allergy_kind" AS ENUM ('drug', 'food', 'environment', 'other');

-- CreateEnum
CREATE TYPE "allergy_severity" AS ENUM ('mild', 'moderate', 'severe');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('draft', 'issued', 'voided');

-- CreateEnum
CREATE TYPE "medication_route" AS ENUM ('oral', 'sublingual', 'topical', 'inhalation', 'nasal', 'ophthalmic', 'otic', 'rectal', 'vaginal', 'intramuscular', 'intravenous', 'subcutaneous', 'other');

-- CreateEnum
CREATE TYPE "work_fitness" AS ENUM ('fit_to_work', 'fit_with_restrictions', 'unfit');

-- CreateEnum
CREATE TYPE "bill_status" AS ENUM ('draft', 'finalized', 'paid', 'voided');

-- CreateEnum
CREATE TYPE "charge_kind" AS ENUM ('consultation', 'procedure', 'laboratory', 'imaging', 'medicine', 'supply', 'other');

-- CreateEnum
CREATE TYPE "bill_discount_kind" AS ENUM ('senior_citizen', 'pwd');

-- AlterTable
ALTER TABLE "encounter" ADD COLUMN     "assessment" TEXT,
ADD COLUMN     "follow_up_on" DATE,
ADD COLUMN     "history" TEXT,
ADD COLUMN     "patient_instructions" TEXT,
ADD COLUMN     "physical_exam" TEXT,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "encounter_bill" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "status" "bill_status" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_kind" "bill_discount_kind",
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "philhealth_package_code" TEXT,
    "philhealth_coverage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalized_at" TIMESTAMP(6),
    "finalized_by_id" TEXT,
    "paid_at" TIMESTAMP(6),
    "or_number" TEXT,
    "voided_at" TIMESTAMP(6),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_charge" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "charge_kind" NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "prescriber_id" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'draft',
    "rx_number" TEXT,
    "notes" TEXT,
    "issued_at" TIMESTAMP(6),
    "prescriber_name" TEXT,
    "prescriber_license" TEXT,
    "prescriber_ptr" TEXT,
    "facility_name" TEXT,
    "facility_address" TEXT,
    "voided_at" TIMESTAMP(6),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_item" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "generic_name" TEXT NOT NULL,
    "brand_name" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "dose" TEXT NOT NULL,
    "route" "medication_route" NOT NULL DEFAULT 'oral',
    "frequency" TEXT NOT NULL,
    "duration_days" INTEGER,
    "quantity" INTEGER NOT NULL,
    "quantity_unit" TEXT,
    "refills" INTEGER NOT NULL DEFAULT 0,
    "instructions" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_certificate" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "issued_by_id" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'draft',
    "certificate_number" TEXT,
    "examined_on" DATE NOT NULL,
    "diagnosis_text" TEXT NOT NULL,
    "fitness" "work_fitness" NOT NULL DEFAULT 'fit_to_work',
    "rest_from" DATE,
    "rest_days" INTEGER,
    "remarks" TEXT,
    "purpose" TEXT,
    "issued_at" TIMESTAMP(6),
    "doctor_name" TEXT,
    "doctor_license" TEXT,
    "doctor_ptr" TEXT,
    "facility_name" TEXT,
    "facility_address" TEXT,
    "voided_at" TIMESTAMP(6),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "systolic_mmhg" INTEGER,
    "diastolic_mmhg" INTEGER,
    "heart_rate_bpm" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature_c" DECIMAL(4,1),
    "spo2_pct" INTEGER,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,1),
    "bmi" DECIMAL(4,1),
    "blood_glucose_mg_dl" INTEGER,
    "pain_score" INTEGER,
    "recorded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" TEXT NOT NULL,
    "voided_at" TIMESTAMP(6),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_diagnosis" (
    "id" TEXT NOT NULL,
    "encounter_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "icd10_code" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "certainty" "diagnosis_certainty" NOT NULL DEFAULT 'provisional',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "voided_at" TIMESTAMP(6),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encounter_diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergy" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "kind" "allergy_kind" NOT NULL DEFAULT 'drug',
    "reaction" TEXT,
    "severity" "allergy_severity",
    "recorded_by_id" TEXT NOT NULL,
    "voided_at" TIMESTAMP(6),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinician_profile" (
    "user_id" TEXT NOT NULL,
    "credentials" TEXT,
    "specialty" TEXT,
    "prc_license_number" TEXT,
    "ptr_number" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_profile_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "encounter_bill_orgId_status_idx" ON "encounter_bill"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_bill_encounter_unique" ON "encounter_bill"("encounter_id", "patient_id");

-- CreateIndex
CREATE INDEX "encounter_charge_billId_position_idx" ON "encounter_charge"("bill_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_rx_number_unique" ON "prescription"("rx_number");

-- CreateIndex
CREATE INDEX "prescription_encounterId_idx" ON "prescription"("encounter_id");

-- CreateIndex
CREATE INDEX "prescription_patientId_idx" ON "prescription"("patient_id");

-- CreateIndex
CREATE INDEX "prescription_item_prescriptionId_position_idx" ON "prescription_item"("prescription_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "medical_certificate_number_unique" ON "medical_certificate"("certificate_number");

-- CreateIndex
CREATE INDEX "medical_certificate_encounterId_idx" ON "medical_certificate"("encounter_id");

-- CreateIndex
CREATE INDEX "medical_certificate_patientId_idx" ON "medical_certificate"("patient_id");

-- CreateIndex
CREATE INDEX "vital_signs_encounterId_recordedAt_idx" ON "vital_signs"("encounter_id", "recorded_at");

-- CreateIndex
CREATE INDEX "vital_signs_patientId_recordedAt_idx" ON "vital_signs"("patient_id", "recorded_at");

-- CreateIndex
CREATE INDEX "encounter_diagnosis_encounterId_idx" ON "encounter_diagnosis"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_diagnosis_icd10Code_idx" ON "encounter_diagnosis"("icd10_code");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_diagnosis_one_primary" ON "encounter_diagnosis"("encounter_id") WHERE (is_primary AND voided_at IS NULL);

-- CreateIndex
CREATE INDEX "patient_allergy_patientId_idx" ON "patient_allergy"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_id_patient_id_unique" ON "encounter"("id", "patient_id");

-- AddForeignKey
ALTER TABLE "encounter_bill" ADD CONSTRAINT "encounter_bill_encounter_fk" FOREIGN KEY ("encounter_id", "patient_id") REFERENCES "encounter"("id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_bill" ADD CONSTRAINT "encounter_bill_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_bill" ADD CONSTRAINT "encounter_bill_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_charge" ADD CONSTRAINT "encounter_charge_bill_id_encounter_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "encounter_bill"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_encounter_fk" FOREIGN KEY ("encounter_id", "patient_id") REFERENCES "encounter"("id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription" ADD CONSTRAINT "prescription_prescriber_id_user_id_fk" FOREIGN KEY ("prescriber_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prescription_item" ADD CONSTRAINT "prescription_item_prescription_id_prescription_id_fk" FOREIGN KEY ("prescription_id") REFERENCES "prescription"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medical_certificate" ADD CONSTRAINT "medical_certificate_encounter_fk" FOREIGN KEY ("encounter_id", "patient_id") REFERENCES "encounter"("id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medical_certificate" ADD CONSTRAINT "medical_certificate_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medical_certificate" ADD CONSTRAINT "medical_certificate_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "medical_certificate" ADD CONSTRAINT "medical_certificate_issued_by_id_user_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_encounter_fk" FOREIGN KEY ("encounter_id", "patient_id") REFERENCES "encounter"("id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_diagnosis" ADD CONSTRAINT "encounter_diagnosis_encounter_fk" FOREIGN KEY ("encounter_id", "patient_id") REFERENCES "encounter"("id", "patient_id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_diagnosis" ADD CONSTRAINT "encounter_diagnosis_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_diagnosis" ADD CONSTRAINT "encounter_diagnosis_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "encounter_diagnosis" ADD CONSTRAINT "encounter_diagnosis_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_allergy" ADD CONSTRAINT "patient_allergy_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_allergy" ADD CONSTRAINT "patient_allergy_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "patient_allergy" ADD CONSTRAINT "patient_allergy_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clinician_profile" ADD CONSTRAINT "clinician_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- Issued documents are immutable. Once a prescription, certificate or bill leaves `draft`, an update may only move
-- its status forward and set the columns named in the trigger arguments (voiding, payment); it never returns to
-- draft, and nothing changes once voided. The triggers bind the owner role too, so system work can't rewrite them.
CREATE FUNCTION "lock_issued_document"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    mutable text[] := TG_ARGV || ARRAY['status', 'updated_at'];
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status::text <> 'draft' THEN
            RAISE EXCEPTION '% % is %, it cannot be deleted', TG_TABLE_NAME, OLD.id, OLD.status
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status::text = 'draft' THEN
        RETURN NEW;
    END IF;
    IF OLD.status::text = 'voided' OR NEW.status::text = 'draft'
        OR (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
        RAISE EXCEPTION '% % is %, it can only be voided', TG_TABLE_NAME, OLD.id, OLD.status
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END
$$;

-- The lines of a document (prescription items, bill charges) change only while the document is a draft.
-- Arguments: the parent table and the line's column that references it.
CREATE FUNCTION "lock_document_lines"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    parent_status text;
    parent_ids text[];
    parent_id text;
BEGIN
    parent_ids := CASE TG_OP
        WHEN 'INSERT' THEN ARRAY[to_jsonb(NEW) ->> TG_ARGV[1]]
        WHEN 'DELETE' THEN ARRAY[to_jsonb(OLD) ->> TG_ARGV[1]]
        ELSE ARRAY[to_jsonb(OLD) ->> TG_ARGV[1], to_jsonb(NEW) ->> TG_ARGV[1]]
    END;
    FOREACH parent_id IN ARRAY parent_ids LOOP
        EXECUTE format('SELECT status::text FROM %I WHERE id = $1', TG_ARGV[0]) INTO parent_status USING parent_id;
        IF parent_status IS NOT NULL AND parent_status <> 'draft' THEN
            RAISE EXCEPTION '% % is %, its lines cannot change', TG_ARGV[0], parent_id, parent_status
                USING ERRCODE = 'check_violation';
        END IF;
    END LOOP;
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE TRIGGER "prescription_lock"
    BEFORE UPDATE OR DELETE ON "prescription"
    FOR EACH ROW EXECUTE FUNCTION "lock_issued_document"('voided_at', 'voided_by_id', 'void_reason');
CREATE TRIGGER "medical_certificate_lock"
    BEFORE UPDATE OR DELETE ON "medical_certificate"
    FOR EACH ROW EXECUTE FUNCTION "lock_issued_document"('voided_at', 'voided_by_id', 'void_reason');
CREATE TRIGGER "encounter_bill_lock"
    BEFORE UPDATE OR DELETE ON "encounter_bill"
    FOR EACH ROW EXECUTE FUNCTION "lock_issued_document"(
        'paid_at', 'or_number', 'voided_at', 'voided_by_id', 'void_reason'
    );
CREATE TRIGGER "prescription_item_lock"
    BEFORE INSERT OR UPDATE OR DELETE ON "prescription_item"
    FOR EACH ROW EXECUTE FUNCTION "lock_document_lines"('prescription', 'prescription_id');
CREATE TRIGGER "encounter_charge_lock"
    BEFORE INSERT OR UPDATE OR DELETE ON "encounter_charge"
    FOR EACH ROW EXECUTE FUNCTION "lock_document_lines"('encounter_bill', 'bill_id');

-- Grants: as in 0006, clinical rows are voided, never deleted; only a draft's lines can be removed.
GRANT SELECT, INSERT, UPDATE ON
    "vital_signs", "encounter_diagnosis", "patient_allergy", "prescription", "medical_certificate",
    "encounter_bill", "clinician_profile"
    TO loopwise_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "prescription_item", "encounter_charge" TO loopwise_app;

-- Policies: the record of a patient is reachable through the patient (app_can_see_patient); a row is written only at
-- one of the user's facilities. Lines follow their document's policy.

ALTER TABLE "vital_signs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vital_signs_access" ON "vital_signs" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "encounter_diagnosis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_diagnosis_access" ON "encounter_diagnosis" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "patient_allergy" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_allergy_access" ON "patient_allergy" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "prescription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_access" ON "prescription" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "prescription_item" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_item_access" ON "prescription_item" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM prescription p WHERE p.id = prescription_id))
    WITH CHECK (EXISTS (SELECT 1 FROM prescription p WHERE p.id = prescription_id));

ALTER TABLE "medical_certificate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medical_certificate_access" ON "medical_certificate" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "encounter_bill" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_bill_access" ON "encounter_bill" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "encounter_charge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_charge_access" ON "encounter_charge" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM encounter_bill b WHERE b.id = bill_id))
    WITH CHECK (EXISTS (SELECT 1 FROM encounter_bill b WHERE b.id = bill_id));

-- Anyone signed in may read a clinician's credentials (they are printed on documents); only they can change them.
ALTER TABLE "clinician_profile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinician_profile_read" ON "clinician_profile" FOR SELECT TO loopwise_app USING (true);
CREATE POLICY "clinician_profile_own" ON "clinician_profile" FOR INSERT TO loopwise_app
    WITH CHECK (user_id = app_user_id());
CREATE POLICY "clinician_profile_own_update" ON "clinician_profile" FOR UPDATE TO loopwise_app
    USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
