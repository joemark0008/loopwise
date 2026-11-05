-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VIEW', 'PRINT', 'EXPORT', 'SIGN', 'VOID', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED');

-- CreateEnum
CREATE TYPE "service_category" AS ENUM ('CONSULTATION', 'PROFESSIONAL_FEE', 'PROCEDURE', 'LABORATORY', 'IMAGING', 'MEDICINE', 'SUPPLY', 'VACCINE', 'PACKAGE', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "tax_type" AS ENUM ('VATABLE', 'VAT_EXEMPT', 'ZERO_RATED');

-- CreateEnum
CREATE TYPE "invoice_doc_type" AS ENUM ('SALES_INVOICE', 'OFFICIAL_RECEIPT', 'ACKNOWLEDGMENT_RECEIPT', 'BILLING_STATEMENT');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('SENIOR_CITIZEN', 'PWD', 'SOLO_PARENT', 'NATIONAL_ATHLETE', 'EMPLOYEE', 'PROMO', 'SPECIAL');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'GCASH', 'MAYA', 'QR_PH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CHECK', 'HMO', 'PHILHEALTH', 'CORPORATE_CHARGE', 'OTHER');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('POSTED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "pf_status" AS ENUM ('UNPAID', 'FOR_RELEASE', 'RELEASED');

-- CreateEnum
CREATE TYPE "encounter_type" AS ENUM ('CONSULTATION', 'FOLLOW_UP', 'TELECONSULTATION', 'PROCEDURE', 'PEME', 'APE', 'KONSULTA_FPE', 'KONSULTA_VISIT', 'PRENATAL', 'WELL_BABY', 'IMMUNIZATION', 'DENTAL', 'EMERGENCY', 'LAB_ONLY');

-- CreateEnum
CREATE TYPE "encounter_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'FOR_BILLING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "disposition" AS ENUM ('SENT_HOME', 'FOR_FOLLOW_UP', 'REFERRED', 'ADMITTED', 'TRANSFERRED_ER', 'EXPIRED');

-- CreateEnum
CREATE TYPE "diagnosis_type" AS ENUM ('PRIMARY', 'SECONDARY', 'WORKING', 'COMORBIDITY');

-- CreateEnum
CREATE TYPE "diagnostic_category" AS ENUM ('LABORATORY', 'IMAGING', 'CARDIO', 'OTHER');

-- CreateEnum
CREATE TYPE "result_value_type" AS ENUM ('NUMERIC', 'TEXT', 'OPTION');

-- CreateEnum
CREATE TYPE "order_priority" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

-- CreateEnum
CREATE TYPE "diagnostic_order_status" AS ENUM ('REQUESTED', 'PAID', 'SPECIMEN_COLLECTED', 'IN_PROGRESS', 'RESULTED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "result_flag" AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL_LOW', 'CRITICAL_HIGH', 'ABNORMAL');

-- CreateEnum
CREATE TYPE "certificate_type" AS ENUM ('MEDICAL_CERTIFICATE', 'FIT_TO_WORK', 'MEDICAL_CLEARANCE', 'PEME_CERTIFICATE', 'APE_CERTIFICATE', 'SSS_SICKNESS', 'VACCINATION_CERTIFICATE', 'DRIVERS_LICENSE_MEDICAL');

-- CreateEnum
CREATE TYPE "referral_status" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('EXTERNAL_LAB_RESULT', 'EXTERNAL_IMAGING', 'CONSENT_FORM', 'IDENTIFICATION', 'REFERRAL_LETTER', 'PHILHEALTH_FORM', 'HMO_LOA', 'PRESCRIPTION_SCAN', 'OTHER');

-- CreateEnum
CREATE TYPE "loa_status" AS ENUM ('REQUESTED', 'APPROVED', 'DENIED', 'USED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "transmittal_status" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_PAID', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "vaccine_route" AS ENUM ('IM', 'SC', 'ID', 'ORAL', 'INTRANASAL');

-- CreateEnum
CREATE TYPE "item_category" AS ENUM ('MEDICINE', 'VACCINE', 'MEDICAL_SUPPLY', 'LAB_REAGENT', 'DENTAL_SUPPLY', 'OFFICE_SUPPLY', 'OTHER');

-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('RECEIPT', 'DISPENSE', 'CONSUMPTION', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN_TO_SUPPLIER', 'RETURN_FROM_PATIENT', 'EXPIRED_DISPOSAL', 'DAMAGED');

-- CreateEnum
CREATE TYPE "care_relationship_reason" AS ENUM ('ENCOUNTER', 'ORDER', 'REFERRAL', 'BREAK_GLASS');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "vat_registration" AS ENUM ('VAT', 'NON_VAT');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'MIDWIFE', 'RECEPTIONIST', 'CASHIER', 'BILLING_CLERK', 'PHARMACIST', 'PHARMACY_ASSISTANT', 'MEDTECH', 'RADTECH', 'INVENTORY_CLERK', 'MEMBER', 'VIEWER', 'CONTEXT_ADMIN');

-- CreateEnum
CREATE TYPE "org_role" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "civil_status" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'LEGALLY_SEPARATED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "blood_type" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "address_type" AS ENUM ('HOME', 'PROVINCIAL', 'WORK', 'BILLING');

-- CreateEnum
CREATE TYPE "identification_type" AS ENUM ('PHILSYS_NATIONAL_ID', 'SENIOR_CITIZEN_OSCA', 'PWD', 'SOLO_PARENT', 'PHILHEALTH_ID', 'SSS', 'GSIS', 'UMID', 'TIN', 'DRIVERS_LICENSE', 'PASSPORT', 'POSTAL_ID', 'VOTERS_ID', 'PRC_ID', 'STUDENT_ID', 'COMPANY_ID', 'BARANGAY_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "allergy_type" AS ENUM ('DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "severity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "problem_status" AS ENUM ('ACTIVE', 'CONTROLLED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "history_category" AS ENUM ('PAST_MEDICAL', 'SURGICAL', 'FAMILY', 'SOCIAL', 'OB_GYN', 'HOSPITALIZATION');

-- CreateEnum
CREATE TYPE "consent_type" AS ENUM ('DATA_PRIVACY', 'GENERAL_TREATMENT', 'PROCEDURE', 'TELEMEDICINE', 'SMS_EMAIL_NOTIFICATIONS', 'MARKETING', 'PHOTO_VIDEO');

-- CreateEnum
CREATE TYPE "contributor_type" AS ENUM ('DIRECT', 'INDIRECT');

-- CreateEnum
CREATE TYPE "philhealth_member_category" AS ENUM ('EMPLOYED_PRIVATE', 'EMPLOYED_GOVERNMENT', 'KASAMBAHAY', 'SELF_EARNING', 'PROFESSIONAL_PRACTITIONER', 'OFW_LAND_BASED', 'OFW_SEA_BASED', 'FILIPINO_WITH_DUAL_CITIZENSHIP', 'LIFETIME_MEMBER', 'INDIGENT_NHTS', 'FOUR_PS', 'SENIOR_CITIZEN', 'PWD', 'SPONSORED_LGU', 'SPONSORED_OTHER', 'POINT_OF_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "dependent_relationship" AS ENUM ('SPOUSE', 'CHILD', 'PARENT');

-- CreateEnum
CREATE TYPE "konsulta_status" AS ENUM ('REGISTERED', 'FPE_DONE', 'ACTIVE', 'TRANSFERRED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "philhealth_claim_type" AS ENUM ('KONSULTA', 'OUTPATIENT_PACKAGE', 'DAY_SURGERY', 'MEDICAL_CASE_RATE', 'OTHER');

-- CreateEnum
CREATE TYPE "philhealth_claim_status" AS ENUM ('DRAFT', 'FOR_SUBMISSION', 'SUBMITTED', 'IN_PROCESS', 'RETURN_TO_HOSPITAL', 'DENIED', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "practitioner_type" AS ENUM ('PHYSICIAN', 'DENTIST', 'MIDWIFE', 'NURSE', 'PSYCHOLOGIST', 'PHYSICAL_THERAPIST', 'NUTRITIONIST_DIETITIAN', 'OPTOMETRIST', 'OTHER');

-- CreateEnum
CREATE TYPE "prescription_status" AS ENUM ('ACTIVE', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "case_rate_type" AS ENUM ('MEDICAL', 'PROCEDURE', 'PACKAGE');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "booking_channel" AS ENUM ('WALK_IN', 'PHONE', 'SMS', 'FACEBOOK_MESSENGER', 'VIBER', 'ONLINE_PORTAL', 'REFERRAL');

-- CreateEnum
CREATE TYPE "visit_type" AS ENUM ('NEW_PATIENT', 'FOLLOW_UP', 'PROCEDURE', 'TELECONSULT', 'PEME', 'APE');

-- CreateEnum
CREATE TYPE "queue_status" AS ENUM ('WAITING', 'CALLED', 'SERVING', 'DONE', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "priority_reason" AS ENUM ('SENIOR_CITIZEN', 'PWD', 'PREGNANT', 'WITH_INFANT', 'EMERGENCY');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "clinic_id" UUID,
    "user_id" UUID,
    "action" "audit_action" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "patient_id" UUID,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT,
    "reason" TEXT,
    "origin" JSONB,
    "request_id" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "service_category" NOT NULL,
    "default_price" DECIMAL(12,2) NOT NULL,
    "tax_type" "tax_type" NOT NULL DEFAULT 'VAT_EXEMPT',
    "is_pf_shareable" BOOLEAN NOT NULL DEFAULT false,
    "diagnostic_test_id" UUID,
    "inventory_item_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_service_prices" (
    "service_item_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "hmo_price" DECIMAL(12,2),

    CONSTRAINT "clinic_service_prices_pkey" PRIMARY KEY ("service_item_id","clinic_id")
);

-- CreateTable
CREATE TABLE "corporate_accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tin" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "contact_no" TEXT,
    "email" TEXT,
    "credit_limit" DECIMAL(12,2),
    "payment_terms_days" INTEGER DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_series" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "doc_type" "invoice_doc_type" NOT NULL DEFAULT 'SALES_INVOICE',
    "prefix" TEXT,
    "start_no" INTEGER NOT NULL,
    "end_no" INTEGER NOT NULL,
    "next_no" INTEGER NOT NULL,
    "permit_no" TEXT,
    "permit_date" DATE,
    "valid_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "invoice_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "series_id" UUID,
    "doc_type" "invoice_doc_type" NOT NULL DEFAULT 'SALES_INVOICE',
    "invoice_no" TEXT,
    "invoice_date" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encounter_id" UUID,
    "corporate_account_id" UUID,
    "buyer_name" TEXT NOT NULL,
    "buyer_tin" TEXT,
    "buyer_address" TEXT,
    "buyer_business_style" TEXT,
    "gross_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatable_sales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_exempt_sales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "zero_rated_sales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "less_vat_sc_pwd" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sc_pwd_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "withholding_tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "remarks" TEXT,
    "created_by_id" UUID,
    "issued_at" TIMESTAMPTZ(3),
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "service_item_id" UUID,
    "encounter_id" UUID,
    "practitioner_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_type" "tax_type" NOT NULL DEFAULT 'VAT_EXEMPT',
    "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL,
    "is_professional_fee" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_discounts" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "invoice_line_id" UUID,
    "identification_id" UUID,
    "type" "discount_type" NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vat_exempted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "beneficiary_name" TEXT,
    "id_number" TEXT,
    "signature_url" TEXT,
    "approved_by_id" UUID,

    CONSTRAINT "invoice_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "payment_no" TEXT NOT NULL,
    "clinic_id" UUID NOT NULL,
    "cashier_shift_id" UUID,
    "method" "payment_method" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "tendered_amount" DECIMAL(12,2),
    "change_amount" DECIMAL(12,2),
    "reference_no" TEXT,
    "bank_name" TEXT,
    "check_date" DATE,
    "hmo_loa_id" UUID,
    "hmo_transmittal_id" UUID,
    "philhealth_claim_id" UUID,
    "corporate_account_id" UUID,
    "status" "payment_status" NOT NULL DEFAULT 'POSTED',
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" UUID,
    "void_reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashier_shifts" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "opening_cash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expected_cash" DECIMAL(12,2),
    "counted_cash" DECIMAL(12,2),
    "variance" DECIMAL(12,2),
    "denominations" JSONB,
    "remarks" TEXT,

    CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_fees" (
    "id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "invoice_line_id" UUID,
    "encounter_id" UUID,
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "clinic_share" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ewt_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "ewt_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(12,2) NOT NULL,
    "status" "pf_status" NOT NULL DEFAULT 'UNPAID',
    "released_at" TIMESTAMPTZ(3),
    "release_ref" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_images" (
    "id" UUID NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chart_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "surface" TEXT NOT NULL DEFAULT 'chat',
    "patient_id" UUID,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "fork_metadata" JSONB,
    "slack_thread_id" TEXT,
    "teams_thread_id" TEXT,
    "telegram_thread_id" TEXT,
    "whatsapp_thread_id" TEXT,
    "mattermost_thread_id" TEXT,
    "discord_thread_id" TEXT,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "sender_user_id" UUID,
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
    "superseded_at" TIMESTAMPTZ(3),
    "source" TEXT,
    "is_forked" BOOLEAN,
    "citation" JSONB,
    "version_group_id" UUID,
    "discord_message_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chat_id" UUID,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "superseded_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_feedback" (
    "message_id" UUID NOT NULL,
    "vote" TEXT NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_feedback_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "message_images" (
    "id" UUID NOT NULL,
    "data" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_parts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
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
    "image_id" UUID,
    "storage_path" TEXT,
    "filename" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_chats" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'clinic',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_chat_access" (
    "shared_chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "shared_chat_access_pkey" PRIMARY KEY ("shared_chat_id","user_id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" UUID NOT NULL,
    "encounter_no" TEXT NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "practitioner_id" UUID,
    "appointment_id" UUID,
    "corporate_account_id" UUID,
    "type" "encounter_type" NOT NULL DEFAULT 'CONSULTATION',
    "status" "encounter_status" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "chief_complaint" TEXT,
    "history_of_present_illness" TEXT,
    "review_of_systems" JSONB,
    "subjective" TEXT,
    "physical_exam" JSONB,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "disposition" "disposition",
    "follow_up_date" DATE,
    "is_confidential" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "patient_instructions" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_chat_id" UUID,

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID,
    "systolic_bp" INTEGER,
    "diastolic_bp" INTEGER,
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "temperature_c" DECIMAL(4,1),
    "oxygen_saturation" INTEGER,
    "weight_kg" DECIMAL(5,2),
    "height_cm" DECIMAL(5,1),
    "bmi" DECIMAL(4,1),
    "waist_cm" DECIMAL(5,1),
    "head_circ_cm" DECIMAL(4,1),
    "blood_glucose" DECIMAL(5,1),
    "pain_score" INTEGER,
    "visual_acuity_od" TEXT,
    "visual_acuity_os" TEXT,
    "notes" TEXT,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_diagnoses" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "icd10_code" TEXT,
    "description" TEXT NOT NULL,
    "type" "diagnosis_type" NOT NULL DEFAULT 'PRIMARY',
    "is_final" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "recorded_by_id" UUID,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "encounter_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounter_procedures" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "rvs_code" TEXT,
    "description" TEXT NOT NULL,
    "performed_by_id" UUID,
    "performed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anesthesia" TEXT,
    "laterality" TEXT,
    "notes" TEXT,

    CONSTRAINT "encounter_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_tests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "diagnostic_category" NOT NULL,
    "section" TEXT,
    "specimen_type" TEXT,
    "requires_fasting" BOOLEAN NOT NULL DEFAULT false,
    "turnaround_hours" INTEGER,
    "is_outsourced" BOOLEAN NOT NULL DEFAULT false,
    "outsourced_lab" TEXT,
    "lis_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "diagnostic_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_test_parameters" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "value_type" "result_value_type" NOT NULL DEFAULT 'NUMERIC',
    "options" TEXT[],
    "ref_low_male" DECIMAL(12,4),
    "ref_high_male" DECIMAL(12,4),
    "ref_low_female" DECIMAL(12,4),
    "ref_high_female" DECIMAL(12,4),
    "ref_range_text" TEXT,
    "lis_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "diagnostic_test_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "encounter_id" UUID NOT NULL,
    "requested_by_id" UUID,
    "external_physician" TEXT,
    "priority" "order_priority" NOT NULL DEFAULT 'ROUTINE',
    "status" "diagnostic_order_status" NOT NULL DEFAULT 'REQUESTED',
    "clinical_info" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "diagnostic_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "status" "diagnostic_order_status" NOT NULL DEFAULT 'REQUESTED',
    "accession_no" TEXT,
    "specimen_collected_at" TIMESTAMPTZ(3),
    "collected_by_id" UUID,
    "status_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "diagnostic_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_results" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "performed_by_id" UUID,
    "verified_by_id" UUID,
    "signed_by_id" UUID,
    "findings" TEXT,
    "impression" TEXT,
    "remarks" TEXT,
    "attachment_url" TEXT,
    "hl7_message_id" TEXT,
    "resulted_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_id" UUID,

    CONSTRAINT "diagnostic_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_result_values" (
    "id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "parameter_id" UUID,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numeric_value" DECIMAL(12,4),
    "unit" TEXT,
    "reference_range" TEXT,
    "flag" "result_flag",

    CONSTRAINT "diagnostic_result_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_certificates" (
    "id" UUID NOT NULL,
    "cert_no" TEXT NOT NULL,
    "encounter_id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "type" "certificate_type" NOT NULL DEFAULT 'MEDICAL_CERTIFICATE',
    "purpose" TEXT,
    "examined_at" TIMESTAMPTZ(3) NOT NULL,
    "diagnosis_text" TEXT,
    "findings" TEXT,
    "recommendation" TEXT,
    "rest_days" INTEGER,
    "rest_from" DATE,
    "rest_to" DATE,
    "is_fit_to_work" BOOLEAN,
    "pe_classification" TEXT,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_code" TEXT NOT NULL,
    "is_void" BOOLEAN NOT NULL DEFAULT false,
    "void_reason" TEXT,
    "document_status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "signatory" JSONB,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medical_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "from_practitioner_id" UUID NOT NULL,
    "to_practitioner_id" UUID,
    "to_external_doctor" TEXT,
    "to_facility" TEXT,
    "specialty" TEXT,
    "reason" TEXT NOT NULL,
    "clinical_summary" TEXT,
    "urgency" "order_priority" NOT NULL DEFAULT 'ROUTINE',
    "status" "referral_status" NOT NULL DEFAULT 'SENT',
    "referred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_notes" TEXT,
    "responded_at" TIMESTAMPTZ(3),

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "type" "document_type" NOT NULL,
    "title" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "document_date" DATE,
    "uploaded_by_id" UUID,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_providers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tin" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "contact_no" TEXT,
    "email" TEXT,
    "accreditation_no" TEXT,
    "payment_terms_days" INTEGER DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hmo_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_hmo_coverages" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "hmo_provider_id" UUID NOT NULL,
    "card_no" TEXT NOT NULL,
    "account_name" TEXT,
    "plan_name" TEXT,
    "mbl" DECIMAL(12,2),
    "is_principal" BOOLEAN NOT NULL DEFAULT true,
    "principal_name" TEXT,
    "valid_from" DATE,
    "valid_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,

    CONSTRAINT "patient_hmo_coverages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_loas" (
    "id" UUID NOT NULL,
    "coverage_id" UUID NOT NULL,
    "encounter_id" UUID,
    "loa_no" TEXT,
    "approved_services" TEXT,
    "diagnosis_text" TEXT,
    "approved_amount" DECIMAL(12,2),
    "status" "loa_status" NOT NULL DEFAULT 'REQUESTED',
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "approved_by_name" TEXT,
    "attachment_key" TEXT,
    "remarks" TEXT,

    CONSTRAINT "hmo_loas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hmo_transmittals" (
    "id" UUID NOT NULL,
    "hmo_provider_id" UUID NOT NULL,
    "transmittal_no" TEXT NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "transmittal_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(3),
    "paid_amount" DECIMAL(12,2),
    "paid_at" TIMESTAMPTZ(3),
    "payment_ref" TEXT,
    "remarks" TEXT,

    CONSTRAINT "hmo_transmittals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "immunizations" (
    "id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "inventory_item_id" UUID,
    "inventory_lot_id" UUID,
    "vaccine_name" TEXT NOT NULL,
    "antigen" TEXT,
    "dose_number" INTEGER,
    "dose_label" TEXT,
    "lot_no" TEXT,
    "expiry_date" DATE,
    "route" "vaccine_route",
    "site" TEXT,
    "administered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administered_by_id" UUID,
    "next_due_date" DATE,
    "is_nip_vaccine" BOOLEAN NOT NULL DEFAULT false,
    "is_historical" BOOLEAN NOT NULL DEFAULT false,
    "adverse_reaction" TEXT,
    "remarks" TEXT,

    CONSTRAINT "immunizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "category" "item_category" NOT NULL,
    "generic_name" TEXT,
    "brand_name" TEXT,
    "strength" TEXT,
    "dosage_form" TEXT,
    "manufacturer" TEXT,
    "fda_cpr_no" TEXT,
    "is_rx_only" BOOLEAN NOT NULL DEFAULT false,
    "is_dangerous_drug" BOOLEAN NOT NULL DEFAULT false,
    "is_antimicrobial" BOOLEAN NOT NULL DEFAULT false,
    "is_pnf" BOOLEAN NOT NULL DEFAULT false,
    "storage_condition" TEXT,
    "unit_of_measure" TEXT NOT NULL,
    "pack_size" INTEGER,
    "tax_type" "tax_type" NOT NULL DEFAULT 'VATABLE',
    "default_cost" DECIMAL(12,2),
    "selling_price" DECIMAL(12,2),
    "reorder_level" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tin" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "contact_no" TEXT,
    "email" TEXT,
    "fda_lto_no" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "supplier_id" UUID,
    "lot_no" TEXT NOT NULL,
    "expiry_date" DATE,
    "quantity_on_hand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID,
    "type" "stock_movement_type" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2),
    "balance_after" DECIMAL(12,2),
    "encounter_id" UUID,
    "invoice_line_id" UUID,
    "prescription_item_id" UUID,
    "stock_receipt_id" UUID,
    "transfer_ref" TEXT,
    "reason" TEXT,
    "performed_by_id" UUID,
    "performed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipts" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "delivery_receipt_no" TEXT,
    "supplier_invoice_no" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_id" UUID,
    "total_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,

    CONSTRAINT "stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "lot_id" UUID,
    "lot_no" TEXT NOT NULL,
    "expiry_date" DATE,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "stock_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_relationships" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reason" "care_relationship_reason" NOT NULL,
    "note" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_documents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'wise_report',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "source_chat_id" UUID NOT NULL,
    "source_tool_call_id" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wise_proposal_outcomes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "tool_call_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wise_proposal_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wise_tool_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" UUID,
    "tool_name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wise_tool_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trade_name" TEXT,
    "tin" TEXT,
    "vat_registration" "vat_registration" NOT NULL DEFAULT 'NON_VAT',
    "sec_or_dti_no" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "slug" TEXT NOT NULL,
    "google_client_id" TEXT,
    "google_client_secret" TEXT,
    "google_auth_domains" TEXT,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "org_role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id","user_id")
);

-- CreateTable
CREATE TABLE "clinics" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bir_branch_code" TEXT,
    "doh_license_no" TEXT,
    "doh_license_expiry" DATE,
    "philhealth_accredit_no" TEXT,
    "philhealth_accredit_exp" DATE,
    "address_line" TEXT,
    "barangay_code" TEXT,
    "city_municipality_code" TEXT,
    "zip_code" TEXT,
    "contact_no" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'local',
    "path" TEXT,
    "agent_settings" JSONB,
    "env_vars" JSONB NOT NULL DEFAULT '{}',
    "display_settings" JSONB,
    "map_settings" JSONB,
    "default_models" JSONB,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "mobile_no" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "requires_password_reset" BOOLEAN NOT NULL DEFAULT false,
    "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
    "messaging_provider_code" TEXT,
    "github_access_token" TEXT,
    "gitlab_access_token" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_clinic_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "role" "staff_role" NOT NULL,

    CONSTRAINT "user_clinic_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT,
    "year" INTEGER,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "pad_length" INTEGER NOT NULL DEFAULT 6,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_llm_configs" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "base_url" TEXT,
    "credentials" JSONB,
    "enabled_models" JSONB NOT NULL DEFAULT '[]',
    "custom_models" JSONB NOT NULL DEFAULT '[]',
    "model_settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinic_llm_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_saved_prompts" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinic_saved_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_groups" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "feature_grants" JSONB NOT NULL DEFAULT '{"version": 2, "features": [], "toolCallDensity": {"canChange": true, "defaultDensity": "detailed"}}',
    "context_grants" JSONB,
    "row_policies" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "patient_no" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "suffix" TEXT,
    "nickname" TEXT,
    "sex" "sex" NOT NULL,
    "birth_date" DATE NOT NULL,
    "birth_place" TEXT,
    "civil_status" "civil_status",
    "nationality" TEXT NOT NULL DEFAULT 'Filipino',
    "religion" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "educational_level" TEXT,
    "blood_type" "blood_type" DEFAULT 'UNKNOWN',
    "mobile_no" TEXT,
    "landline_no" TEXT,
    "email" TEXT,
    "photo_url" TEXT,
    "preferred_language" TEXT,
    "notes" TEXT,
    "is_deceased" BOOLEAN NOT NULL DEFAULT false,
    "deceased_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_addresses" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "address_type" NOT NULL DEFAULT 'HOME',
    "address_line" TEXT,
    "barangay_code" TEXT,
    "city_municipality_code" TEXT,
    "zip_code" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "patient_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_contacts" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "mobile_no" TEXT,
    "address" TEXT,
    "is_emergency" BOOLEAN NOT NULL DEFAULT true,
    "is_guardian" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "patient_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_identifications" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "identification_type" NOT NULL,
    "id_number" TEXT NOT NULL,
    "issued_by" TEXT,
    "issued_at" DATE,
    "expires_at" DATE,
    "image_url" TEXT,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_identifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "type" "allergy_type" NOT NULL,
    "allergen" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" "severity",
    "noted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_problems" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "icd10_code" TEXT,
    "description" TEXT NOT NULL,
    "status" "problem_status" NOT NULL DEFAULT 'ACTIVE',
    "onset_date" DATE,
    "resolved_date" DATE,
    "notes" TEXT,

    CONSTRAINT "patient_problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_histories" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "category" "history_category" NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "encounter_id" UUID,
    "type" "consent_type" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "signed_by" TEXT,
    "signature_url" TEXT,
    "witnessed_by_id" UUID,
    "signed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "philhealth_memberships" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "pin" TEXT NOT NULL,
    "is_principal" BOOLEAN NOT NULL DEFAULT true,
    "member_pin" TEXT,
    "member_name" TEXT,
    "relationship_to_member" "dependent_relationship",
    "contributor_type" "contributor_type",
    "category" "philhealth_member_category",
    "employer_name" TEXT,
    "employer_pen" TEXT,
    "valid_from" DATE,
    "valid_to" DATE,
    "last_verified_at" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "philhealth_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "konsulta_enrollments" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "atc_no" TEXT,
    "registered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fpe_encounter_id" UUID,
    "fpe_completed_at" TIMESTAMPTZ(3),
    "status" "konsulta_status" NOT NULL DEFAULT 'REGISTERED',
    "remarks" TEXT,

    CONSTRAINT "konsulta_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "philhealth_claims" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "encounter_id" UUID NOT NULL,
    "invoice_id" UUID,
    "type" "philhealth_claim_type" NOT NULL,
    "first_case_rate_id" UUID,
    "second_case_rate_id" UUID,
    "service_date_from" DATE NOT NULL,
    "service_date_to" DATE,
    "claim_series_lhio" TEXT,
    "total_actual_charges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "facility_benefit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "professional_benefit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "philhealth_claim_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(3),
    "return_reason" TEXT,
    "approved_amount" DECIMAL(12,2),
    "paid_amount" DECIMAL(12,2),
    "paid_at" TIMESTAMPTZ(3),
    "payment_reference" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "philhealth_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "type" "practitioner_type" NOT NULL DEFAULT 'PHYSICIAN',
    "title" TEXT,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "suffix" TEXT,
    "post_nominals" TEXT,
    "sex" "sex",
    "specialty" TEXT,
    "subspecialty" TEXT,
    "mobile_no" TEXT,
    "email" TEXT,
    "prc_license_no" TEXT NOT NULL,
    "prc_license_expiry" DATE,
    "ptr_no" TEXT,
    "ptr_issued_date" DATE,
    "ptr_issued_at" TEXT,
    "s2_license_no" TEXT,
    "s2_license_expiry" DATE,
    "philhealth_pan" TEXT,
    "philhealth_pan_expiry" DATE,
    "tin" TEXT,
    "signature_url" TEXT,
    "default_consult_fee" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_clinics" (
    "practitioner_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "room_name" TEXT,
    "consult_fee" DECIMAL(12,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "practitioner_clinics_pkey" PRIMARY KEY ("practitioner_id","clinic_id")
);

-- CreateTable
CREATE TABLE "practitioner_schedules" (
    "id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "slot_minutes" INTEGER NOT NULL DEFAULT 15,
    "max_patients" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "practitioner_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_leaves" (
    "id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "practitioner_leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "rx_no" TEXT NOT NULL,
    "encounter_id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATE,
    "is_dangerous_drug" BOOLEAN NOT NULL DEFAULT false,
    "s2_form_serial_no" TEXT,
    "status" "prescription_status" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "verification_code" TEXT,
    "document_status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "signatory" JSONB,
    "voided_at" TIMESTAMPTZ(3),
    "voided_by_id" UUID,
    "void_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescription_id" UUID NOT NULL,
    "inventory_item_id" UUID,
    "generic_name" TEXT NOT NULL,
    "brand_name" TEXT,
    "strength" TEXT,
    "dosage_form" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "quantity_in_words" TEXT,
    "unit" TEXT,
    "sig" TEXT NOT NULL,
    "route" TEXT,
    "frequency" TEXT,
    "duration_days" INTEGER,
    "is_prn" BOOLEAN NOT NULL DEFAULT false,
    "dispensed_qty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "provinces" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,

    CONSTRAINT "provinces_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "city_municipalities" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "province_code" TEXT,
    "is_city" BOOLEAN NOT NULL DEFAULT false,
    "is_huc" BOOLEAN NOT NULL DEFAULT false,
    "zip_code" TEXT,

    CONSTRAINT "city_municipalities_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "barangays" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city_municipality_code" TEXT NOT NULL,

    CONSTRAINT "barangays_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "icd10_codes" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parent_code" TEXT,
    "is_billable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "icd10_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "rvs_codes" (
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rvu" DECIMAL(8,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rvs_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "philhealth_case_rates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "case_rate_type" NOT NULL,
    "description" TEXT NOT NULL,
    "icd10_code" TEXT,
    "rvs_code" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "facility_fee" DECIMAL(12,2) NOT NULL,
    "professional_fee" DECIMAL(12,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "circular_ref" TEXT,

    CONSTRAINT "philhealth_case_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "practitioner_id" UUID NOT NULL,
    "scheduled_start" TIMESTAMPTZ(3) NOT NULL,
    "scheduled_end" TIMESTAMPTZ(3),
    "visit_type" "visit_type" NOT NULL DEFAULT 'NEW_PATIENT',
    "channel" "booking_channel" NOT NULL DEFAULT 'WALK_IN',
    "status" "appointment_status" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "notes" TEXT,
    "reminder_sent_at" TIMESTAMPTZ(3),
    "cancelled_reason" TEXT,
    "rescheduled_from" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_tickets" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "queue_date" DATE NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'A',
    "number" INTEGER NOT NULL,
    "is_priority" BOOLEAN NOT NULL DEFAULT false,
    "priority_reason" "priority_reason",
    "practitioner_id" UUID,
    "encounter_id" UUID,
    "station" TEXT,
    "status" "queue_status" NOT NULL DEFAULT 'WAITING',
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "called_at" TIMESTAMPTZ(3),
    "served_at" TIMESTAMPTZ(3),
    "done_at" TIMESTAMPTZ(3),

    CONSTRAINT "queue_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_inferences" (
    "id" UUID NOT NULL,
    "clinic_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "chat_id" UUID,
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
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_inferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_patient_id_created_at_idx" ON "audit_logs"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "service_items_diagnostic_test_id_key" ON "service_items"("diagnostic_test_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_items_inventory_item_id_key" ON "service_items"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_items_organization_id_code_key" ON "service_items"("organization_id", "code");

-- CreateIndex
CREATE INDEX "invoice_series_clinic_id_doc_type_is_active_idx" ON "invoice_series"("clinic_id", "doc_type", "is_active");

-- CreateIndex
CREATE INDEX "invoices_encounter_id_idx" ON "invoices"("encounter_id");

-- CreateIndex
CREATE INDEX "invoices_clinic_id_invoice_date_idx" ON "invoices"("clinic_id", "invoice_date");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_clinic_id_doc_type_invoice_no_key" ON "invoices"("clinic_id", "doc_type", "invoice_no");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_encounter_id_idx" ON "invoice_lines"("encounter_id");

-- CreateIndex
CREATE INDEX "invoice_discounts_invoice_id_idx" ON "invoice_discounts"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_discounts_type_idx" ON "invoice_discounts"("type");

-- CreateIndex
CREATE INDEX "payments_clinic_id_received_at_idx" ON "payments"("clinic_id", "received_at");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "payments"("method");

-- CreateIndex
CREATE UNIQUE INDEX "payments_clinic_id_payment_no_key" ON "payments"("clinic_id", "payment_no");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_invoice_id_key" ON "payment_allocations"("payment_id", "invoice_id");

-- CreateIndex
CREATE INDEX "cashier_shifts_clinic_id_opened_at_idx" ON "cashier_shifts"("clinic_id", "opened_at");

-- CreateIndex
CREATE UNIQUE INDEX "professional_fees_invoice_line_id_key" ON "professional_fees"("invoice_line_id");

-- CreateIndex
CREATE INDEX "professional_fees_practitioner_id_status_idx" ON "professional_fees"("practitioner_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chart_images_tool_call_id_key" ON "chart_images"("tool_call_id");

-- CreateIndex
CREATE INDEX "chats_clinic_id_idx" ON "chats"("clinic_id");

-- CreateIndex
CREATE INDEX "chats_user_id_idx" ON "chats"("user_id");

-- CreateIndex
CREATE INDEX "chats_slack_thread_id_idx" ON "chats"("slack_thread_id");

-- CreateIndex
CREATE INDEX "chats_teams_thread_id_idx" ON "chats"("teams_thread_id");

-- CreateIndex
CREATE INDEX "chats_telegram_thread_id_idx" ON "chats"("telegram_thread_id");

-- CreateIndex
CREATE INDEX "chats_whatsapp_thread_id_idx" ON "chats"("whatsapp_thread_id");

-- CreateIndex
CREATE INDEX "chats_mattermost_thread_id_idx" ON "chats"("mattermost_thread_id");

-- CreateIndex
CREATE INDEX "chats_discord_thread_id_idx" ON "chats"("discord_thread_id");

-- CreateIndex
CREATE UNIQUE INDEX "chats_one_chart_chat_per_user_patient" ON "chats"("user_id", "patient_id") WHERE ((patient_id IS NOT NULL) AND (deleted_at IS NULL));

-- CreateIndex
CREATE INDEX "chat_messages_chat_id_created_at_idx" ON "chat_messages"("chat_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_discord_message_id_idx" ON "chat_messages"("discord_message_id");

-- CreateIndex
CREATE INDEX "chat_messages_sender_user_id_idx" ON "chat_messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "chat_messages_version_group_id_idx" ON "chat_messages"("version_group_id");

-- CreateIndex
CREATE INDEX "memories_chat_id_idx" ON "memories"("chat_id");

-- CreateIndex
CREATE INDEX "memories_superseded_by_idx" ON "memories"("superseded_by");

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_parts_tool_call_id_key" ON "message_parts"("tool_call_id");

-- CreateIndex
CREATE INDEX "message_parts_message_id_order_idx" ON "message_parts"("message_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "shared_chats_chat_id_key" ON "shared_chats"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_appointment_id_key" ON "encounters"("appointment_id");

-- CreateIndex
CREATE INDEX "encounters_patient_id_started_at_idx" ON "encounters"("patient_id", "started_at");

-- CreateIndex
CREATE INDEX "encounters_practitioner_id_started_at_idx" ON "encounters"("practitioner_id", "started_at");

-- CreateIndex
CREATE INDEX "encounters_clinic_id_status_idx" ON "encounters"("clinic_id", "status");

-- CreateIndex
CREATE INDEX "encounters_clinic_id_patient_id_idx" ON "encounters"("clinic_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_clinic_id_encounter_no_key" ON "encounters"("clinic_id", "encounter_no");

-- CreateIndex
CREATE INDEX "vital_signs_encounter_id_idx" ON "vital_signs"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_diagnoses_encounter_id_idx" ON "encounter_diagnoses"("encounter_id");

-- CreateIndex
CREATE INDEX "encounter_diagnoses_icd10_code_idx" ON "encounter_diagnoses"("icd10_code");

-- CreateIndex
CREATE UNIQUE INDEX "encounter_diagnoses_one_primary" ON "encounter_diagnoses"("encounter_id") WHERE ((type = 'PRIMARY'::diagnosis_type) AND (voided_at IS NULL));

-- CreateIndex
CREATE INDEX "encounter_procedures_encounter_id_idx" ON "encounter_procedures"("encounter_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_tests_organization_id_code_key" ON "diagnostic_tests"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_test_parameters_test_id_code_key" ON "diagnostic_test_parameters"("test_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_orders_order_no_key" ON "diagnostic_orders"("order_no");

-- CreateIndex
CREATE INDEX "diagnostic_orders_encounter_id_idx" ON "diagnostic_orders"("encounter_id");

-- CreateIndex
CREATE INDEX "diagnostic_orders_status_idx" ON "diagnostic_orders"("status");

-- CreateIndex
CREATE INDEX "diagnostic_order_items_order_id_idx" ON "diagnostic_order_items"("order_id");

-- CreateIndex
CREATE INDEX "diagnostic_order_items_accession_no_idx" ON "diagnostic_order_items"("accession_no");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_results_order_item_id_key" ON "diagnostic_results"("order_item_id");

-- CreateIndex
CREATE INDEX "diagnostic_result_values_result_id_idx" ON "diagnostic_result_values"("result_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_certificates_cert_no_key" ON "medical_certificates"("cert_no");

-- CreateIndex
CREATE UNIQUE INDEX "medical_certificates_verification_code_key" ON "medical_certificates"("verification_code");

-- CreateIndex
CREATE INDEX "medical_certificates_encounter_id_idx" ON "medical_certificates"("encounter_id");

-- CreateIndex
CREATE INDEX "referrals_encounter_id_idx" ON "referrals"("encounter_id");

-- CreateIndex
CREATE INDEX "patient_documents_patient_id_type_idx" ON "patient_documents"("patient_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_providers_organization_id_code_key" ON "hmo_providers"("organization_id", "code");

-- CreateIndex
CREATE INDEX "patient_hmo_coverages_patient_id_idx" ON "patient_hmo_coverages"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "patient_hmo_coverages_hmo_provider_id_card_no_key" ON "patient_hmo_coverages"("hmo_provider_id", "card_no");

-- CreateIndex
CREATE INDEX "hmo_loas_coverage_id_idx" ON "hmo_loas"("coverage_id");

-- CreateIndex
CREATE INDEX "hmo_loas_loa_no_idx" ON "hmo_loas"("loa_no");

-- CreateIndex
CREATE UNIQUE INDEX "hmo_transmittals_transmittal_no_key" ON "hmo_transmittals"("transmittal_no");

-- CreateIndex
CREATE INDEX "immunizations_encounter_id_idx" ON "immunizations"("encounter_id");

-- CreateIndex
CREATE INDEX "immunizations_next_due_date_idx" ON "immunizations"("next_due_date");

-- CreateIndex
CREATE INDEX "inventory_items_generic_name_idx" ON "inventory_items"("generic_name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_organization_id_sku_key" ON "inventory_items"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "inventory_lots_clinic_id_expiry_date_idx" ON "inventory_lots"("clinic_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_item_id_clinic_id_lot_no_key" ON "inventory_lots"("item_id", "clinic_id", "lot_no");

-- CreateIndex
CREATE INDEX "stock_movements_clinic_id_item_id_performed_at_idx" ON "stock_movements"("clinic_id", "item_id", "performed_at");

-- CreateIndex
CREATE INDEX "stock_movements_lot_id_idx" ON "stock_movements"("lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_receipts_clinic_id_receipt_no_key" ON "stock_receipts"("clinic_id", "receipt_no");

-- CreateIndex
CREATE INDEX "care_relationships_user_id_patient_id_idx" ON "care_relationships"("user_id", "patient_id");

-- CreateIndex
CREATE INDEX "care_relationships_patient_id_user_id_idx" ON "care_relationships"("patient_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_documents_source_tool_call_id_key" ON "clinical_documents"("source_tool_call_id");

-- CreateIndex
CREATE INDEX "clinical_documents_patient_id_created_at_idx" ON "clinical_documents"("patient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wise_proposal_outcomes_tool_call_id_key" ON "wise_proposal_outcomes"("tool_call_id");

-- CreateIndex
CREATE INDEX "wise_proposal_outcomes_chat_id_idx" ON "wise_proposal_outcomes"("chat_id");

-- CreateIndex
CREATE INDEX "wise_tool_settings_organization_id_idx" ON "wise_tool_settings"("organization_id");

-- CreateIndex
CREATE INDEX "wise_tool_settings_user_id_idx" ON "wise_tool_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wise_tool_settings_org_tool_unique" ON "wise_tool_settings"("organization_id", "tool_name") WHERE (organization_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "wise_tool_settings_user_tool_unique" ON "wise_tool_settings"("user_id", "tool_name") WHERE (user_id IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_organization_id_code_key" ON "clinics"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_messaging_provider_code_key" ON "users"("messaging_provider_code");

-- CreateIndex
CREATE INDEX "user_clinic_roles_clinic_id_idx" ON "user_clinic_roles"("clinic_id");

-- CreateIndex
CREATE INDEX "user_clinic_roles_user_id_role_idx" ON "user_clinic_roles"("user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_clinic_roles_user_id_clinic_id_role_key" ON "user_clinic_roles"("user_id", "clinic_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_clinic_id_key_year_key" ON "document_sequences"("clinic_id", "key", "year");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_llm_configs_clinic_id_provider_key" ON "clinic_llm_configs"("clinic_id", "provider");

-- CreateIndex
CREATE INDEX "clinic_saved_prompts_clinic_id_idx" ON "clinic_saved_prompts"("clinic_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_one_default_per_clinic" ON "user_groups"("clinic_id") WHERE (is_default = true);

-- CreateIndex
CREATE UNIQUE INDEX "user_groups_clinic_id_name_key" ON "user_groups"("clinic_id", "name");

-- CreateIndex
CREATE INDEX "patients_organization_id_last_name_first_name_birth_date_idx" ON "patients"("organization_id", "last_name", "first_name", "birth_date");

-- CreateIndex
CREATE INDEX "patients_mobile_no_idx" ON "patients"("mobile_no");

-- CreateIndex
CREATE UNIQUE INDEX "patients_organization_id_patient_no_key" ON "patients"("organization_id", "patient_no");

-- CreateIndex
CREATE INDEX "patient_addresses_patient_id_idx" ON "patient_addresses"("patient_id");

-- CreateIndex
CREATE INDEX "patient_contacts_patient_id_idx" ON "patient_contacts"("patient_id");

-- CreateIndex
CREATE INDEX "patient_identifications_type_id_number_idx" ON "patient_identifications"("type", "id_number");

-- CreateIndex
CREATE UNIQUE INDEX "patient_identifications_patient_id_type_id_number_key" ON "patient_identifications"("patient_id", "type", "id_number");

-- CreateIndex
CREATE INDEX "patient_allergies_patient_id_idx" ON "patient_allergies"("patient_id");

-- CreateIndex
CREATE INDEX "patient_problems_patient_id_idx" ON "patient_problems"("patient_id");

-- CreateIndex
CREATE INDEX "patient_histories_patient_id_category_idx" ON "patient_histories"("patient_id", "category");

-- CreateIndex
CREATE INDEX "patient_consents_patient_id_type_idx" ON "patient_consents"("patient_id", "type");

-- CreateIndex
CREATE INDEX "philhealth_memberships_pin_idx" ON "philhealth_memberships"("pin");

-- CreateIndex
CREATE INDEX "philhealth_memberships_patient_id_idx" ON "philhealth_memberships"("patient_id");

-- CreateIndex
CREATE INDEX "konsulta_enrollments_clinic_id_year_idx" ON "konsulta_enrollments"("clinic_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "konsulta_enrollments_membership_id_year_key" ON "konsulta_enrollments"("membership_id", "year");

-- CreateIndex
CREATE INDEX "philhealth_claims_status_idx" ON "philhealth_claims"("status");

-- CreateIndex
CREATE INDEX "philhealth_claims_encounter_id_idx" ON "philhealth_claims"("encounter_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_user_id_key" ON "practitioners"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_prc_license_no_key" ON "practitioners"("prc_license_no");

-- CreateIndex
CREATE INDEX "practitioners_last_name_first_name_idx" ON "practitioners"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "practitioner_schedules_practitioner_id_day_of_week_idx" ON "practitioner_schedules"("practitioner_id", "day_of_week");

-- CreateIndex
CREATE INDEX "practitioner_leaves_practitioner_id_start_at_idx" ON "practitioner_leaves"("practitioner_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_rx_no_key" ON "prescriptions"("rx_no");

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_verification_code_key" ON "prescriptions"("verification_code");

-- CreateIndex
CREATE INDEX "prescriptions_encounter_id_idx" ON "prescriptions"("encounter_id");

-- CreateIndex
CREATE INDEX "prescription_items_prescription_id_idx" ON "prescription_items"("prescription_id");

-- CreateIndex
CREATE INDEX "provinces_region_code_idx" ON "provinces"("region_code");

-- CreateIndex
CREATE INDEX "city_municipalities_province_code_idx" ON "city_municipalities"("province_code");

-- CreateIndex
CREATE INDEX "city_municipalities_region_code_idx" ON "city_municipalities"("region_code");

-- CreateIndex
CREATE INDEX "barangays_city_municipality_code_idx" ON "barangays"("city_municipality_code");

-- CreateIndex
CREATE INDEX "icd10_codes_description_idx" ON "icd10_codes"("description");

-- CreateIndex
CREATE UNIQUE INDEX "philhealth_case_rates_code_effective_from_key" ON "philhealth_case_rates"("code", "effective_from");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_scheduled_start_idx" ON "appointments"("clinic_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "appointments_practitioner_id_scheduled_start_idx" ON "appointments"("practitioner_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_clinic_id_patient_id_idx" ON "appointments"("clinic_id", "patient_id");

-- CreateIndex
CREATE INDEX "queue_tickets_clinic_id_queue_date_status_idx" ON "queue_tickets"("clinic_id", "queue_date", "status");

-- CreateIndex
CREATE INDEX "queue_tickets_encounter_id_idx" ON "queue_tickets"("encounter_id");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tickets_clinic_id_queue_date_prefix_number_key" ON "queue_tickets"("clinic_id", "queue_date", "prefix", "number");

-- CreateIndex
CREATE INDEX "llm_inferences_created_at_idx" ON "llm_inferences"("created_at");

-- CreateIndex
CREATE INDEX "llm_inferences_clinic_id_idx" ON "llm_inferences"("clinic_id");

-- CreateIndex
CREATE INDEX "llm_inferences_type_idx" ON "llm_inferences"("type");

-- CreateIndex
CREATE INDEX "llm_inferences_user_id_idx" ON "llm_inferences"("user_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_diagnostic_test_id_fkey" FOREIGN KEY ("diagnostic_test_id") REFERENCES "diagnostic_tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_service_prices" ADD CONSTRAINT "clinic_service_prices_service_item_id_fkey" FOREIGN KEY ("service_item_id") REFERENCES "service_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_service_prices" ADD CONSTRAINT "clinic_service_prices_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_accounts" ADD CONSTRAINT "corporate_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_series" ADD CONSTRAINT "invoice_series_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "invoice_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_service_item_id_fkey" FOREIGN KEY ("service_item_id") REFERENCES "service_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discounts" ADD CONSTRAINT "invoice_discounts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discounts" ADD CONSTRAINT "invoice_discounts_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_discounts" ADD CONSTRAINT "invoice_discounts_identification_id_fkey" FOREIGN KEY ("identification_id") REFERENCES "patient_identifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_cashier_shift_id_fkey" FOREIGN KEY ("cashier_shift_id") REFERENCES "cashier_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_hmo_loa_id_fkey" FOREIGN KEY ("hmo_loa_id") REFERENCES "hmo_loas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_hmo_transmittal_id_fkey" FOREIGN KEY ("hmo_transmittal_id") REFERENCES "hmo_transmittals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_philhealth_claim_id_fkey" FOREIGN KEY ("philhealth_claim_id") REFERENCES "philhealth_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_fees" ADD CONSTRAINT "professional_fees_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_fees" ADD CONSTRAINT "professional_fees_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_fees" ADD CONSTRAINT "professional_fees_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_feedback" ADD CONSTRAINT "message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "message_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_chats" ADD CONSTRAINT "shared_chats_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_chat_access" ADD CONSTRAINT "shared_chat_access_shared_chat_id_fkey" FOREIGN KEY ("shared_chat_id") REFERENCES "shared_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_chat_access" ADD CONSTRAINT "shared_chat_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "encounter_diagnoses_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_diagnoses" ADD CONSTRAINT "encounter_diagnoses_icd10_code_fkey" FOREIGN KEY ("icd10_code") REFERENCES "icd10_codes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "encounter_procedures_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "encounter_procedures_rvs_code_fkey" FOREIGN KEY ("rvs_code") REFERENCES "rvs_codes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounter_procedures" ADD CONSTRAINT "encounter_procedures_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_tests" ADD CONSTRAINT "diagnostic_tests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_test_parameters" ADD CONSTRAINT "diagnostic_test_parameters_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "diagnostic_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_order_items" ADD CONSTRAINT "diagnostic_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "diagnostic_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_order_items" ADD CONSTRAINT "diagnostic_order_items_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "diagnostic_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "diagnostic_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_result_values" ADD CONSTRAINT "diagnostic_result_values_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "diagnostic_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_result_values" ADD CONSTRAINT "diagnostic_result_values_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "diagnostic_test_parameters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_certificates" ADD CONSTRAINT "medical_certificates_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_from_practitioner_id_fkey" FOREIGN KEY ("from_practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_to_practitioner_id_fkey" FOREIGN KEY ("to_practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_providers" ADD CONSTRAINT "hmo_providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_hmo_coverages" ADD CONSTRAINT "patient_hmo_coverages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_hmo_coverages" ADD CONSTRAINT "patient_hmo_coverages_hmo_provider_id_fkey" FOREIGN KEY ("hmo_provider_id") REFERENCES "hmo_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_loas" ADD CONSTRAINT "hmo_loas_coverage_id_fkey" FOREIGN KEY ("coverage_id") REFERENCES "patient_hmo_coverages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_loas" ADD CONSTRAINT "hmo_loas_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hmo_transmittals" ADD CONSTRAINT "hmo_transmittals_hmo_provider_id_fkey" FOREIGN KEY ("hmo_provider_id") REFERENCES "hmo_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_administered_by_id_fkey" FOREIGN KEY ("administered_by_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "immunizations" ADD CONSTRAINT "immunizations_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_prescription_item_id_fkey" FOREIGN KEY ("prescription_item_id") REFERENCES "prescription_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_receipt_id_fkey" FOREIGN KEY ("stock_receipt_id") REFERENCES "stock_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_relationships" ADD CONSTRAINT "care_relationships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_documents" ADD CONSTRAINT "clinical_documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wise_tool_settings" ADD CONSTRAINT "wise_tool_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wise_tool_settings" ADD CONSTRAINT "wise_tool_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_barangay_code_fkey" FOREIGN KEY ("barangay_code") REFERENCES "barangays"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_city_municipality_code_fkey" FOREIGN KEY ("city_municipality_code") REFERENCES "city_municipalities"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_clinic_roles" ADD CONSTRAINT "user_clinic_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_clinic_roles" ADD CONSTRAINT "user_clinic_roles_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_llm_configs" ADD CONSTRAINT "clinic_llm_configs_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_saved_prompts" ADD CONSTRAINT "clinic_saved_prompts_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_barangay_code_fkey" FOREIGN KEY ("barangay_code") REFERENCES "barangays"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_addresses" ADD CONSTRAINT "patient_addresses_city_municipality_code_fkey" FOREIGN KEY ("city_municipality_code") REFERENCES "city_municipalities"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_identifications" ADD CONSTRAINT "patient_identifications_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_problems" ADD CONSTRAINT "patient_problems_icd10_code_fkey" FOREIGN KEY ("icd10_code") REFERENCES "icd10_codes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_histories" ADD CONSTRAINT "patient_histories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_memberships" ADD CONSTRAINT "philhealth_memberships_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konsulta_enrollments" ADD CONSTRAINT "konsulta_enrollments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "philhealth_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konsulta_enrollments" ADD CONSTRAINT "konsulta_enrollments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "konsulta_enrollments" ADD CONSTRAINT "konsulta_enrollments_fpe_encounter_id_fkey" FOREIGN KEY ("fpe_encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_claims" ADD CONSTRAINT "philhealth_claims_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "philhealth_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_claims" ADD CONSTRAINT "philhealth_claims_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_claims" ADD CONSTRAINT "philhealth_claims_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_claims" ADD CONSTRAINT "philhealth_claims_first_case_rate_id_fkey" FOREIGN KEY ("first_case_rate_id") REFERENCES "philhealth_case_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_claims" ADD CONSTRAINT "philhealth_claims_second_case_rate_id_fkey" FOREIGN KEY ("second_case_rate_id") REFERENCES "philhealth_case_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_clinics" ADD CONSTRAINT "practitioner_clinics_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_clinics" ADD CONSTRAINT "practitioner_clinics_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_schedules" ADD CONSTRAINT "practitioner_schedules_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_schedules" ADD CONSTRAINT "practitioner_schedules_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_leaves" ADD CONSTRAINT "practitioner_leaves_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provinces" ADD CONSTRAINT "provinces_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_municipalities" ADD CONSTRAINT "city_municipalities_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_municipalities" ADD CONSTRAINT "city_municipalities_province_code_fkey" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barangays" ADD CONSTRAINT "barangays_city_municipality_code_fkey" FOREIGN KEY ("city_municipality_code") REFERENCES "city_municipalities"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_case_rates" ADD CONSTRAINT "philhealth_case_rates_icd10_code_fkey" FOREIGN KEY ("icd10_code") REFERENCES "icd10_codes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "philhealth_case_rates" ADD CONSTRAINT "philhealth_case_rates_rvs_code_fkey" FOREIGN KEY ("rvs_code") REFERENCES "rvs_codes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_inferences" ADD CONSTRAINT "llm_inferences_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_inferences" ADD CONSTRAINT "llm_inferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_inferences" ADD CONSTRAINT "llm_inferences_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
