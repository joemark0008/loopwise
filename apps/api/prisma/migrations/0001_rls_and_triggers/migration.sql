-- Hand-written SQL that Prisma cannot express, applied right after 0000_init (DESIGN.md §5, §8):
--   1. roles and grants (loopwise_app for user-scoped work, the analytics roles)
--   2. row-level security: helper functions and a policy on every clinical table (deny by default)
--   3. triggers: append-only tables, row versions, issued-document locks, the diagnostic order status machine
--   4. check constraints
--   5. the analytics schema for Wise (identity binding and curated views)
--
-- The app connects as the database owner (a superuser in development), which row-level security never restricts.
-- User-scoped work runs in a transaction that sets `app.user_id` and switches to `loopwise_app` (`SET LOCAL ROLE`, see
-- apps/api/src/clinical/rls/clinical-db.service.ts); the policies below apply to that role. System work (registration
-- duplicate checks, jobs, seeds) keeps the connection's role and writes its own audit rows.

-- =====================================================================================================================
-- 1. Roles
-- =====================================================================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loopwise_app') THEN
        CREATE ROLE loopwise_app NOLOGIN NOBYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loopwise_analytics_owner') THEN
        CREATE ROLE loopwise_analytics_owner NOLOGIN NOBYPASSRLS INHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loopwise_analyst') THEN
        -- Synthetic development password; deployments set their own (ANALYTICS_DATABASE_URL).
        CREATE ROLE loopwise_analyst LOGIN NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE PASSWORD 'loopwise_analyst';
    END IF;
END
$$;

GRANT loopwise_app TO CURRENT_USER;
GRANT loopwise_app TO loopwise_analytics_owner;
GRANT loopwise_analytics_owner TO CURRENT_USER;
ALTER ROLE loopwise_analyst SET statement_timeout = '5s';
ALTER ROLE loopwise_analyst SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE loopwise_analyst SET work_mem = '16MB';
ALTER ROLE loopwise_analyst SET search_path = analytics;

GRANT USAGE ON SCHEMA public TO loopwise_app;

-- =====================================================================================================================
-- 2. Row-level security
-- =====================================================================================================================

-- Identity binding for Wise analytics (section 5), out of reach of both app roles. Created here because
-- `app_user_id()` reads it.
CREATE SCHEMA "app_private";
REVOKE ALL ON SCHEMA "app_private" FROM PUBLIC;

CREATE TABLE "app_private"."analytics_grant" (
    "token_hash" TEXT PRIMARY KEY,
    "user_id"    UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL
);

CREATE TABLE "app_private"."analytics_identity" (
    "xact_id"    XID8 PRIMARY KEY,
    "user_id"    UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

-- The signed-in user: the analytics identity bound to this transaction, else (never for the analyst) `app.user_id`.
CREATE FUNCTION "app_user_id"() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(
        (SELECT i.user_id FROM app_private.analytics_identity i WHERE i.xact_id = pg_current_xact_id_if_assigned()),
        CASE WHEN session_user = 'loopwise_analyst' THEN NULL
             ELSE nullif(current_setting('app.user_id', true), '')::uuid END
    )
$$;

-- Helpers are SECURITY DEFINER: they run as the owner, so they read across the policies (no policy recursion).

-- Organizations the user belongs to: as a member, or through a role at one of its clinics.
CREATE FUNCTION "app_org_ids"() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(array_agg(DISTINCT org_id), '{}') FROM (
        SELECT m.organization_id AS org_id FROM organization_members m WHERE m.user_id = app_user_id()
        UNION
        SELECT c.organization_id FROM user_clinic_roles r JOIN clinics c ON c.id = r.clinic_id
        WHERE r.user_id = app_user_id()
    ) orgs
$$;

-- Clinics the user works at: a role there, or membership of its organization.
CREATE FUNCTION "app_clinic_ids"() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(array_agg(DISTINCT clinic_id), '{}') FROM (
        SELECT r.clinic_id FROM user_clinic_roles r WHERE r.user_id = app_user_id()
        UNION
        SELECT c.id FROM clinics c JOIN organization_members m ON m.organization_id = c.organization_id
        WHERE m.user_id = app_user_id()
    ) clinics
$$;

-- Clinics where the user holds one of the roles.
CREATE FUNCTION "app_clinic_ids_with_role"(p_roles staff_role[]) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(array_agg(DISTINCT r.clinic_id), '{}') FROM user_clinic_roles r
    WHERE r.user_id = app_user_id() AND r.role = ANY (p_roles)
$$;

-- Deny by default. A user sees a patient through:
--  * their own unexpired care relationship (a doctor's encounter, a referral, a logged break-glass);
--  * a desk role at a clinic where the patient has a visit or an appointment (front desk, nurses and midwives at
--    triage, cashier and billing);
--  * a lab role (medtech, radtech) at a clinic where the patient has a diagnostic order.
CREATE FUNCTION "app_can_see_patient"(p_patient_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
            SELECT 1 FROM care_relationships r
            WHERE r.patient_id = p_patient_id AND r.user_id = app_user_id()
                AND (r.expires_at IS NULL OR r.expires_at > now())
        )
        OR EXISTS (
            SELECT 1 FROM encounters e
            WHERE e.patient_id = p_patient_id
                AND e.clinic_id = ANY (app_clinic_ids_with_role(
                    ARRAY['RECEPTIONIST', 'NURSE', 'MIDWIFE', 'CASHIER', 'BILLING_CLERK']::staff_role[]))
        )
        OR EXISTS (
            SELECT 1 FROM appointments a
            WHERE a.patient_id = p_patient_id
                AND a.clinic_id = ANY (app_clinic_ids_with_role(
                    ARRAY['RECEPTIONIST', 'NURSE', 'MIDWIFE']::staff_role[]))
        )
        OR EXISTS (
            SELECT 1 FROM diagnostic_orders o JOIN encounters e ON e.id = o.encounter_id
            WHERE e.patient_id = p_patient_id
                AND e.clinic_id = ANY (app_clinic_ids_with_role(ARRAY['MEDTECH', 'RADTECH']::staff_role[]))
        )
$$;

-- Encounter children have no patient column (the reference's encounter-centric rule): they are reached through their
-- encounter. Reading needs the patient; writing also needs the visit to be at one of the user's clinics.
CREATE FUNCTION "app_can_see_encounter"(p_encounter_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM encounters e WHERE e.id = p_encounter_id AND app_can_see_patient(e.patient_id)
    )
$$;

CREATE FUNCTION "app_can_write_encounter"(p_encounter_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM encounters e
        WHERE e.id = p_encounter_id AND e.clinic_id = ANY (app_clinic_ids()) AND app_can_see_patient(e.patient_id)
    )
$$;

-- Grants. Clinical rows are voided or cancelled, never deleted by users; only a draft's lines can be removed.

-- Reference data: readable by everyone signed in.
GRANT SELECT ON "regions", "provinces", "city_municipalities", "barangays", "icd10_codes", "rvs_codes",
    "philhealth_case_rates" TO loopwise_app;

-- Who's who: needed to show names and to check access in nested reads.
GRANT SELECT ON "organizations", "clinics", "users", "user_clinic_roles", "organization_members" TO loopwise_app;

GRANT SELECT, INSERT, UPDATE ON
    -- patient master
    "patients", "patient_addresses", "patient_contacts", "patient_identifications", "patient_allergies",
    "patient_problems", "patient_histories", "patient_consents", "patient_documents",
    "philhealth_memberships", "patient_hmo_coverages",
    -- scheduling
    "appointments", "queue_tickets",
    -- the encounter and its record
    "encounters", "vital_signs", "encounter_diagnoses", "encounter_procedures", "immunizations",
    "prescriptions", "prescription_items", "medical_certificates", "referrals",
    "diagnostic_orders", "diagnostic_order_items", "diagnostic_results", "diagnostic_result_values",
    -- catalogs of the organization
    "diagnostic_tests", "diagnostic_test_parameters", "service_items", "clinic_service_prices",
    "corporate_accounts", "hmo_providers", "inventory_items", "suppliers",
    -- clinic operations
    "document_sequences", "practitioners", "practitioner_clinics", "practitioner_schedules", "practitioner_leaves",
    "invoice_series", "invoices", "invoice_lines", "invoice_discounts", "payments", "payment_allocations",
    "cashier_shifts", "professional_fees", "philhealth_claims", "konsulta_enrollments", "hmo_loas",
    "hmo_transmittals", "inventory_lots", "stock_receipts", "stock_receipt_items"
    TO loopwise_app;
GRANT DELETE ON "prescription_items", "invoice_lines", "invoice_discounts", "diagnostic_result_values"
    TO loopwise_app;
-- History only grows.
GRANT SELECT, INSERT ON "audit_logs", "clinical_documents", "wise_proposal_outcomes", "stock_movements"
    TO loopwise_app;
-- Access grants are system work.
GRANT SELECT ON "care_relationships" TO loopwise_app;

-- Policies. ENABLE (not FORCE): the owner keeps full access for system work.

-- Patients: through the patient; a user only writes patients of their own organizations.
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_access" ON "patients" TO loopwise_app
    USING (app_can_see_patient(id))
    WITH CHECK (app_can_see_patient(id) AND organization_id = ANY (app_org_ids()));

-- Patient master data: through its patient.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['patient_addresses', 'patient_contacts', 'patient_identifications', 'patient_allergies',
        'patient_problems', 'patient_histories', 'patient_consents', 'patient_documents', 'philhealth_memberships',
        'patient_hmo_coverages', 'clinical_documents']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I TO loopwise_app USING (app_can_see_patient(patient_id)) '
            'WITH CHECK (app_can_see_patient(patient_id))', t || '_access', t);
    END LOOP;
END
$$;

-- A saved Wise report is written by its author only.
DROP POLICY "clinical_documents_access" ON "clinical_documents";
CREATE POLICY "clinical_documents_access" ON "clinical_documents" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND created_by_id = app_user_id());

ALTER TABLE "care_relationships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "care_relationships_own" ON "care_relationships" FOR SELECT TO loopwise_app
    USING (user_id = app_user_id());

-- Encounters: read through the patient; written only at one of the user's clinics.
ALTER TABLE "encounters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounters_access" ON "encounters" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND clinic_id = ANY (app_clinic_ids()));

-- Encounter children (encounter_id NOT NULL): through the encounter.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['vital_signs', 'encounter_diagnoses', 'encounter_procedures', 'immunizations',
        'prescriptions', 'medical_certificates', 'referrals', 'diagnostic_orders', 'philhealth_claims']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I TO loopwise_app USING (app_can_see_encounter(encounter_id)) '
            'WITH CHECK (app_can_write_encounter(encounter_id))', t || '_access', t);
    END LOOP;
END
$$;

-- Rows below a parent follow the parent's policy (the EXISTS runs under the parent's row-level security).
ALTER TABLE "prescription_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescription_items_access" ON "prescription_items" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = prescription_id))
    WITH CHECK (EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = prescription_id));

ALTER TABLE "diagnostic_order_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagnostic_order_items_access" ON "diagnostic_order_items" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM diagnostic_orders o WHERE o.id = order_id))
    WITH CHECK (EXISTS (SELECT 1 FROM diagnostic_orders o WHERE o.id = order_id));

ALTER TABLE "diagnostic_results" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagnostic_results_access" ON "diagnostic_results" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM diagnostic_order_items i WHERE i.id = order_item_id))
    WITH CHECK (EXISTS (SELECT 1 FROM diagnostic_order_items i WHERE i.id = order_item_id));

ALTER TABLE "diagnostic_result_values" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagnostic_result_values_access" ON "diagnostic_result_values" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM diagnostic_results r WHERE r.id = result_id))
    WITH CHECK (EXISTS (SELECT 1 FROM diagnostic_results r WHERE r.id = result_id));

-- Encounter-optional rows (the reference makes these optional).
ALTER TABLE "hmo_loas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hmo_loas_access" ON "hmo_loas" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM patient_hmo_coverages c WHERE c.id = coverage_id))
    WITH CHECK (EXISTS (SELECT 1 FROM patient_hmo_coverages c WHERE c.id = coverage_id)
        AND (encounter_id IS NULL OR app_can_write_encounter(encounter_id)));

ALTER TABLE "konsulta_enrollments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "konsulta_enrollments_access" ON "konsulta_enrollments" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM philhealth_memberships m WHERE m.id = membership_id))
    WITH CHECK (EXISTS (SELECT 1 FROM philhealth_memberships m WHERE m.id = membership_id)
        AND clinic_id = ANY (app_clinic_ids()));

ALTER TABLE "professional_fees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "professional_fees_access" ON "professional_fees" TO loopwise_app
    USING (
        EXISTS (SELECT 1 FROM practitioners p WHERE p.id = practitioner_id AND p.user_id = app_user_id())
        OR (encounter_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM encounters e WHERE e.id = encounter_id AND e.clinic_id = ANY (app_clinic_ids_with_role(
                ARRAY['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'BILLING_CLERK']::staff_role[]))))
    )
    WITH CHECK (encounter_id IS NULL OR app_can_write_encounter(encounter_id));

-- Clinic operations: staff of the clinic. Invoices and payments are the cashier's; they carry no patient column, so
-- the clinic is the boundary (an invoice's encounter, when set, is still checked on write).
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['appointments', 'queue_tickets', 'document_sequences', 'invoice_series', 'payments',
        'cashier_shifts', 'clinic_service_prices', 'inventory_lots', 'stock_movements', 'stock_receipts',
        'practitioner_clinics', 'practitioner_schedules']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I TO loopwise_app USING (clinic_id = ANY (app_clinic_ids())) '
            'WITH CHECK (clinic_id = ANY (app_clinic_ids()))', t || '_access', t);
    END LOOP;
END
$$;

-- Appointments and queue tickets also name the patient: booking needs to see them.
DROP POLICY "appointments_access" ON "appointments";
CREATE POLICY "appointments_access" ON "appointments" TO loopwise_app
    USING (clinic_id = ANY (app_clinic_ids()) AND app_can_see_patient(patient_id))
    WITH CHECK (clinic_id = ANY (app_clinic_ids()) AND app_can_see_patient(patient_id));

DROP POLICY "queue_tickets_access" ON "queue_tickets";
CREATE POLICY "queue_tickets_access" ON "queue_tickets" TO loopwise_app
    USING (clinic_id = ANY (app_clinic_ids()))
    WITH CHECK (clinic_id = ANY (app_clinic_ids()) AND (encounter_id IS NULL OR app_can_write_encounter(encounter_id)));

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_access" ON "invoices" TO loopwise_app
    USING (clinic_id = ANY (app_clinic_ids()))
    WITH CHECK (clinic_id = ANY (app_clinic_ids()) AND (encounter_id IS NULL OR app_can_write_encounter(encounter_id)));

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['invoice_lines', 'invoice_discounts']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I TO loopwise_app '
            'USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id)) '
            'WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id))', t || '_access', t);
    END LOOP;
END
$$;

ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_allocations_access" ON "payment_allocations" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id))
    WITH CHECK (EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_id)
        AND EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id));

ALTER TABLE "stock_receipt_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_receipt_items_access" ON "stock_receipt_items" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM stock_receipts r WHERE r.id = receipt_id))
    WITH CHECK (EXISTS (SELECT 1 FROM stock_receipts r WHERE r.id = receipt_id));

-- Catalogs of the organization: its staff read and maintain them.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['diagnostic_tests', 'service_items', 'corporate_accounts', 'hmo_providers',
        'inventory_items', 'suppliers']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format(
            'CREATE POLICY %I ON %I TO loopwise_app USING (organization_id = ANY (app_org_ids())) '
            'WITH CHECK (organization_id = ANY (app_org_ids()))', t || '_access', t);
    END LOOP;
END
$$;

ALTER TABLE "diagnostic_test_parameters" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagnostic_test_parameters_access" ON "diagnostic_test_parameters" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM diagnostic_tests t WHERE t.id = test_id))
    WITH CHECK (EXISTS (SELECT 1 FROM diagnostic_tests t WHERE t.id = test_id));

ALTER TABLE "hmo_transmittals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hmo_transmittals_access" ON "hmo_transmittals" TO loopwise_app
    USING (EXISTS (SELECT 1 FROM hmo_providers p WHERE p.id = hmo_provider_id))
    WITH CHECK (EXISTS (SELECT 1 FROM hmo_providers p WHERE p.id = hmo_provider_id));

-- Practitioners: anyone signed in reads credentials (they are printed on documents); only the practitioner edits
-- their own. Leaves follow the practitioner.
ALTER TABLE "practitioners" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioners_read" ON "practitioners" FOR SELECT TO loopwise_app USING (true);
CREATE POLICY "practitioners_own_insert" ON "practitioners" FOR INSERT TO loopwise_app
    WITH CHECK (user_id = app_user_id());
CREATE POLICY "practitioners_own_update" ON "practitioners" FOR UPDATE TO loopwise_app
    USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

ALTER TABLE "practitioner_leaves" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_leaves_read" ON "practitioner_leaves" FOR SELECT TO loopwise_app USING (true);
CREATE POLICY "practitioner_leaves_own" ON "practitioner_leaves" FOR INSERT TO loopwise_app
    WITH CHECK (EXISTS (SELECT 1 FROM practitioners p WHERE p.id = practitioner_id AND p.user_id = app_user_id()));
CREATE POLICY "practitioner_leaves_own_update" ON "practitioner_leaves" FOR UPDATE TO loopwise_app
    USING (EXISTS (SELECT 1 FROM practitioners p WHERE p.id = practitioner_id AND p.user_id = app_user_id()));

-- The audit log and Wise outcomes: a user writes and reads only their own rows.
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_own" ON "audit_logs" TO loopwise_app
    USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

ALTER TABLE "wise_proposal_outcomes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wise_proposal_outcomes_own" ON "wise_proposal_outcomes" TO loopwise_app
    USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

-- The indexes these policies lean on (encounters by clinic and patient, appointments by clinic and patient, care
-- relationships by patient and user, clinic roles by user and role, every child's encounter_id) are in the Prisma
-- schema, so 0000_init creates them.

-- =====================================================================================================================
-- 3. Triggers
-- =====================================================================================================================

-- Append-only history: the audit log, saved Wise reports, Wise card outcomes and the stock ledger are never changed
-- or removed, by anyone (the trigger binds the owner role too).
CREATE FUNCTION "reject_append_only_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
CREATE TRIGGER "clinical_documents_append_only" BEFORE UPDATE OR DELETE ON "clinical_documents"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
CREATE TRIGGER "wise_proposal_outcomes_append_only" BEFORE UPDATE OR DELETE ON "wise_proposal_outcomes"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();
CREATE TRIGGER "stock_movements_append_only" BEFORE UPDATE OR DELETE ON "stock_movements"
    FOR EACH ROW EXECUTE FUNCTION "reject_append_only_change"();

-- Row versions: the version moves on every update, whoever makes it, so a Wise card's check against the version it
-- drafted from can't be skipped by another writer.
CREATE FUNCTION "bump_row_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "encounters_version" BEFORE UPDATE ON "encounters"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();
CREATE TRIGGER "prescriptions_version" BEFORE UPDATE ON "prescriptions"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();
CREATE TRIGGER "medical_certificates_version" BEFORE UPDATE ON "medical_certificates"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();
CREATE TRIGGER "invoices_version" BEFORE UPDATE ON "invoices"
    FOR EACH ROW EXECUTE FUNCTION "bump_row_version"();

-- Issued documents are immutable. Arguments: the status column, its draft value, the column that marks the row voided
-- and the value meaning voided (`*` = not null), then the columns an update may still change after issue. While a
-- draft, anything goes; once issued, only those columns move, it never returns to draft, and nothing changes once
-- voided. Deleting is allowed only for drafts. The `*_version` triggers fire after the `*_lock` triggers (name
-- order), so the lock sees the version unchanged.
CREATE FUNCTION "lock_issued_document"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    status_column text := TG_ARGV[0];
    draft_value text := TG_ARGV[1];
    void_column text := TG_ARGV[2];
    void_value text := TG_ARGV[3];
    mutable text[] := TG_ARGV[4:] || ARRAY['updated_at', 'version'];
    old_row jsonb := to_jsonb(OLD);
    new_row jsonb;
    was_voided boolean;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF old_row ->> status_column <> draft_value THEN
            RAISE EXCEPTION '% % is %, it cannot be deleted', TG_TABLE_NAME, OLD.id, old_row ->> status_column
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF old_row ->> status_column = draft_value THEN
        RETURN NEW;
    END IF;
    new_row := to_jsonb(NEW);
    was_voided := CASE WHEN void_value = '*' THEN old_row ->> void_column IS NOT NULL
                       ELSE old_row ->> void_column = void_value END;
    IF was_voided OR new_row ->> status_column = draft_value OR (new_row - mutable) IS DISTINCT FROM (old_row - mutable)
    THEN
        RAISE EXCEPTION '% % is issued, it can only be voided', TG_TABLE_NAME, OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END
$$;

-- The lines of a document change only while the document is a draft, apart from the columns named after the
-- parent's status column and draft value (e.g. dispensing against an issued prescription's items).
-- Arguments: parent table, the line's column referencing it, the parent's status column, its draft value, then the
-- line columns an update may change after issue.
CREATE FUNCTION "lock_document_lines"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    parent_table text := TG_ARGV[0];
    parent_column text := TG_ARGV[1];
    status_column text := TG_ARGV[2];
    draft_value text := TG_ARGV[3];
    mutable text[] := TG_ARGV[4:];
    parent_status text;
    parent_ids text[];
    parent_id text;
BEGIN
    parent_ids := CASE TG_OP
        WHEN 'INSERT' THEN ARRAY[to_jsonb(NEW) ->> parent_column]
        WHEN 'DELETE' THEN ARRAY[to_jsonb(OLD) ->> parent_column]
        ELSE ARRAY[to_jsonb(OLD) ->> parent_column, to_jsonb(NEW) ->> parent_column]
    END;
    FOREACH parent_id IN ARRAY parent_ids LOOP
        EXECUTE format('SELECT %I::text FROM %I WHERE id = $1::uuid', status_column, parent_table)
            INTO parent_status USING parent_id;
        IF parent_status IS NOT NULL AND parent_status <> draft_value THEN
            IF TG_OP = 'UPDATE' AND cardinality(mutable) > 0
                AND (to_jsonb(NEW) - mutable) IS NOT DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
                CONTINUE;
            END IF;
            RAISE EXCEPTION '% % is %, its lines cannot change', parent_table, parent_id, parent_status
                USING ERRCODE = 'check_violation';
        END IF;
    END LOOP;
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END
$$;

-- Prescriptions: after issue only dispensing (status) and voiding (status CANCELLED + who, when, why) move.
CREATE TRIGGER "prescriptions_lock" BEFORE UPDATE OR DELETE ON "prescriptions"
    FOR EACH ROW EXECUTE FUNCTION "lock_issued_document"(
        'document_status', 'DRAFT', 'voided_at', '*', 'status', 'voided_at', 'voided_by_id', 'void_reason');
CREATE TRIGGER "prescription_items_lock" BEFORE INSERT OR UPDATE OR DELETE ON "prescription_items"
    FOR EACH ROW EXECUTE FUNCTION "lock_document_lines"(
        'prescriptions', 'prescription_id', 'document_status', 'DRAFT', 'dispensed_qty', 'inventory_item_id');

-- Medical certificates: after issue only voiding.
CREATE TRIGGER "medical_certificates_lock" BEFORE UPDATE OR DELETE ON "medical_certificates"
    FOR EACH ROW EXECUTE FUNCTION "lock_issued_document"(
        'document_status', 'DRAFT', 'is_void', 'true', 'is_void', 'void_reason', 'voided_at', 'voided_by_id');

-- Invoices (BIR: an issued sales invoice is never edited, only voided): after issue only payment and voiding move.
CREATE TRIGGER "invoices_lock" BEFORE UPDATE OR DELETE ON "invoices"
    FOR EACH ROW EXECUTE FUNCTION "lock_issued_document"(
        'status', 'DRAFT', 'status', 'VOID', 'status', 'amount_paid', 'balance', 'voided_at', 'voided_by_id',
        'void_reason');
CREATE TRIGGER "invoice_lines_lock" BEFORE INSERT OR UPDATE OR DELETE ON "invoice_lines"
    FOR EACH ROW EXECUTE FUNCTION "lock_document_lines"('invoices', 'invoice_id', 'status', 'DRAFT');
CREATE TRIGGER "invoice_discounts_lock" BEFORE INSERT OR UPDATE OR DELETE ON "invoice_discounts"
    FOR EACH ROW EXECUTE FUNCTION "lock_document_lines"('invoices', 'invoice_id', 'status', 'DRAFT');

-- The diagnostic order status machine, for every writer (users and system work alike), on the order and on each
-- item; the API mirrors it in apps/api/src/clinical/diagnostics/orders/diagnostic-order-status.ts. Payment may come
-- before extraction (PAID); a released result that needs correcting goes back to IN_PROGRESS.
CREATE FUNCTION "check_diagnostic_order_transition"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status::text = 'REQUESTED'
            AND NEW.status::text IN ('PAID', 'SPECIMEN_COLLECTED', 'IN_PROGRESS', 'RESULTED', 'CANCELLED'))
        OR (OLD.status::text = 'PAID'
            AND NEW.status::text IN ('SPECIMEN_COLLECTED', 'IN_PROGRESS', 'RESULTED', 'CANCELLED'))
        OR (OLD.status::text = 'SPECIMEN_COLLECTED' AND NEW.status::text IN ('IN_PROGRESS', 'RESULTED', 'CANCELLED'))
        OR (OLD.status::text = 'IN_PROGRESS' AND NEW.status::text IN ('RESULTED', 'CANCELLED'))
        OR (OLD.status::text = 'RESULTED' AND NEW.status::text IN ('RELEASED', 'IN_PROGRESS'))
        OR (OLD.status::text = 'RELEASED' AND NEW.status::text = 'IN_PROGRESS')
    ) THEN
        RAISE EXCEPTION '% % cannot go from % to %', TG_TABLE_NAME, OLD.id, OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "diagnostic_orders_transition" BEFORE UPDATE OF "status" ON "diagnostic_orders"
    FOR EACH ROW EXECUTE FUNCTION "check_diagnostic_order_transition"();
CREATE TRIGGER "diagnostic_order_items_transition" BEFORE UPDATE OF "status" ON "diagnostic_order_items"
    FOR EACH ROW EXECUTE FUNCTION "check_diagnostic_order_transition"();

-- =====================================================================================================================
-- 4. Check constraints
-- =====================================================================================================================

-- Chat message parts carry the fields their type needs (from the base app).
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_file_fields_required" CHECK (
    CASE WHEN type = 'file' THEN media_type IS NOT NULL AND (image_id IS NOT NULL OR storage_path IS NOT NULL)
         ELSE true END);
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_reasoning_text_required" CHECK (
    CASE WHEN type = 'reasoning' THEN reasoning_text IS NOT NULL ELSE true END);
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_text_required" CHECK (
    CASE WHEN type = 'text' THEN text IS NOT NULL ELSE true END);
ALTER TABLE "message_parts" ADD CONSTRAINT "message_parts_tool_call_fields_required" CHECK (
    CASE WHEN type LIKE 'tool-%' THEN tool_call_id IS NOT NULL AND tool_state IS NOT NULL ELSE true END);

-- A local Wise workspace has a folder for its context files.
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_local_path_required" CHECK (
    CASE WHEN kind = 'local' THEN path IS NOT NULL ELSE true END);

ALTER TABLE "wise_proposal_outcomes" ADD CONSTRAINT "wise_proposal_outcomes_status_check"
    CHECK (status IN ('confirmed', 'cancelled'));

-- Either an organization's setting or a user's own, never both.
ALTER TABLE "wise_tool_settings" ADD CONSTRAINT "wise_tool_settings_owner_check"
    CHECK ((organization_id IS NULL) <> (user_id IS NULL));

-- dayOfWeek: 0 = Sunday … 6 = Saturday.
ALTER TABLE "practitioner_schedules" ADD CONSTRAINT "practitioner_schedules_day_of_week_check"
    CHECK (day_of_week BETWEEN 0 AND 6);

-- A referral goes somewhere: a practitioner here, or an outside doctor or facility.
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_target_required"
    CHECK (to_practitioner_id IS NOT NULL OR to_external_doctor IS NOT NULL OR to_facility IS NOT NULL);

-- A queue number is positive; a pain score is 0–10.
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_number_positive" CHECK (number > 0);
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_pain_score_range" CHECK (pain_score BETWEEN 0 AND 10);

-- =====================================================================================================================
-- 5. Analytics for Wise (DESIGN.md §7.2, §8.3)
--
-- Curated read-only views of the clinical tables that Wise may query with SQL, as the signed-in user and nothing
-- more. Layers, each enforced by Postgres even if the API's SQL validator misses something:
-- 1. `loopwise_analyst` is its own LOGIN role on its own connection pool, with SELECT on `analytics.*` and EXECUTE on
--    `analytics.bind` only, and no other role to switch to.
-- 2. The views are owned by `loopwise_analytics_owner` (a member of `loopwise_app`, NOBYPASSRLS) and are not
--    `security_invoker`: they read the base tables as that owner, so every row still passes the policies above,
--    evaluated for the bound user.
-- 3. The user is bound per transaction by `analytics.bind(token)`: a one-time token the API issued as the system user,
--    consumed here and recorded against the transaction id in `app_private`, which neither role can reach.
--    `app_user_id()` prefers that record and ignores `app.user_id` for the analyst.
-- 4. The API runs each query read-only, with a statement timeout and a row cap (analytics.repository.ts).
-- Enum values are lowercased in the views. No phone numbers, ID numbers or free-text notes beyond the chief complaint.
-- =====================================================================================================================

-- The analyst sees no table of `public`.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM loopwise_analyst;

-- Analyst sessions share one role, so the activity view would show one doctor another doctor's SQL text.
REVOKE SELECT ON pg_catalog.pg_stat_activity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_catalog.pg_stat_get_activity(integer) FROM PUBLIC;

CREATE SCHEMA "analytics";
REVOKE ALL ON SCHEMA "analytics" FROM PUBLIC;
GRANT USAGE ON SCHEMA "analytics" TO loopwise_analyst, loopwise_analytics_owner;
GRANT CREATE ON SCHEMA "analytics" TO loopwise_analytics_owner;
GRANT USAGE ON SCHEMA "app_private" TO loopwise_analytics_owner;
GRANT SELECT, DELETE ON "app_private"."analytics_grant" TO loopwise_analytics_owner;
GRANT SELECT, INSERT, DELETE ON "app_private"."analytics_identity" TO loopwise_analytics_owner;

-- Binds the transaction to the user a one-time token was issued for. The only function the analyst may call.
CREATE FUNCTION "analytics"."bind"(p_token text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = app_private, pg_temp AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM analytics_identity WHERE xact_id = pg_current_xact_id_if_assigned()) THEN
        RAISE EXCEPTION 'analytics session already bound';
    END IF;
    DELETE FROM analytics_grant
        WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') AND expires_at > now()
        RETURNING user_id INTO v_user_id;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'invalid or expired analytics token';
    END IF;
    DELETE FROM analytics_identity WHERE created_at < now() - interval '5 minutes';
    INSERT INTO analytics_identity (xact_id, user_id) VALUES (pg_current_xact_id(), v_user_id);
END
$$;
ALTER FUNCTION "analytics"."bind"(text) OWNER TO loopwise_analytics_owner;
REVOKE ALL ON FUNCTION "analytics"."bind"(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "analytics"."bind"(text) TO loopwise_analyst;

-- ICD-10 chapter of a code, as apps/shared/src/icd10-chapters.ts has it.
CREATE FUNCTION "analytics"."icd10_chapter"(p_code text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT CASE
        WHEN c BETWEEN 'A00' AND 'B99' THEN 'Infectious and parasitic diseases (A00–B99)'
        WHEN c BETWEEN 'C00' AND 'D48' THEN 'Neoplasms (C00–D48)'
        WHEN c BETWEEN 'D50' AND 'D89' THEN 'Blood and immune disorders (D50–D89)'
        WHEN c BETWEEN 'E00' AND 'E90' THEN 'Endocrine, nutritional and metabolic (E00–E90)'
        WHEN c BETWEEN 'F00' AND 'F99' THEN 'Mental and behavioural (F00–F99)'
        WHEN c BETWEEN 'G00' AND 'G99' THEN 'Nervous system (G00–G99)'
        WHEN c BETWEEN 'H00' AND 'H59' THEN 'Eye (H00–H59)'
        WHEN c BETWEEN 'H60' AND 'H95' THEN 'Ear (H60–H95)'
        WHEN c BETWEEN 'I00' AND 'I99' THEN 'Circulatory system (I00–I99)'
        WHEN c BETWEEN 'J00' AND 'J99' THEN 'Respiratory system (J00–J99)'
        WHEN c BETWEEN 'K00' AND 'K93' THEN 'Digestive system (K00–K93)'
        WHEN c BETWEEN 'L00' AND 'L99' THEN 'Skin (L00–L99)'
        WHEN c BETWEEN 'M00' AND 'M99' THEN 'Musculoskeletal (M00–M99)'
        WHEN c BETWEEN 'N00' AND 'N99' THEN 'Genitourinary system (N00–N99)'
        WHEN c BETWEEN 'O00' AND 'O99' THEN 'Pregnancy and childbirth (O00–O99)'
        WHEN c BETWEEN 'P00' AND 'P96' THEN 'Perinatal conditions (P00–P96)'
        WHEN c BETWEEN 'Q00' AND 'Q99' THEN 'Congenital anomalies (Q00–Q99)'
        WHEN c BETWEEN 'R00' AND 'R99' THEN 'Symptoms and abnormal findings (R00–R99)'
        WHEN c BETWEEN 'S00' AND 'T98' THEN 'Injury and poisoning (S00–T98)'
        WHEN c BETWEEN 'V01' AND 'Y98' THEN 'External causes (V01–Y98)'
        WHEN c BETWEEN 'Z00' AND 'Z99' THEN 'Health status and services (Z00–Z99)'
        WHEN c BETWEEN 'U00' AND 'U99' THEN 'Special purposes (U00–U99)'
    END
    FROM (SELECT upper(left(trim(p_code), 3)) AS c) code
$$;
ALTER FUNCTION "analytics"."icd10_chapter"(text) OWNER TO loopwise_analytics_owner;
GRANT EXECUTE ON FUNCTION "analytics"."icd10_chapter"(text) TO loopwise_analyst;

-- The views: owned by `loopwise_analytics_owner` (RLS applies), `security_barrier` so no user predicate runs before
-- the view's own.

CREATE VIEW "analytics"."patients" WITH (security_barrier = true) AS
SELECT
    p.id AS patient_id,
    p.first_name || ' ' || p.last_name AS name,
    lower(p.sex::text) AS sex,
    extract(year FROM p.birth_date)::int AS birth_year,
    extract(year FROM age(current_date, p.birth_date))::int AS age_years,
    CASE
        WHEN age(current_date, p.birth_date) < interval '5 years' THEN '0-4'
        WHEN age(current_date, p.birth_date) < interval '18 years' THEN '5-17'
        WHEN age(current_date, p.birth_date) < interval '40 years' THEN '18-39'
        WHEN age(current_date, p.birth_date) < interval '60 years' THEN '40-59'
        ELSE '60+'
    END AS age_band,
    (SELECT b.name FROM patient_addresses a JOIN barangays b ON b.code = a.barangay_code
        WHERE a.patient_id = p.id ORDER BY a.is_primary DESC, a.id LIMIT 1) AS barangay,
    p.preferred_language,
    EXISTS (SELECT 1 FROM patient_consents c WHERE c.patient_id = p.id AND c.type = 'DATA_PRIVACY' AND c.granted
        AND c.revoked_at IS NULL) AS has_consent,
    p.organization_id,
    p.created_at AS registered_at
FROM patients p
WHERE p.deleted_at IS NULL;

CREATE VIEW "analytics"."encounters" WITH (security_barrier = true) AS
SELECT
    e.id AS encounter_id,
    e.patient_id,
    e.clinic_id AS facility_id,
    c.name AS facility,
    pr.user_id AS doctor_id,
    e.started_at,
    lower(e.type::text) AS type,
    lower(e.status::text) AS status,
    e.chief_complaint AS reason,
    e.follow_up_date AS follow_up_on
FROM encounters e
JOIN clinics c ON c.id = e.clinic_id
LEFT JOIN practitioners pr ON pr.id = e.practitioner_id;

CREATE VIEW "analytics"."vitals" WITH (security_barrier = true) AS
SELECT
    v.id AS vitals_id,
    v.encounter_id,
    e.patient_id,
    v.recorded_at,
    v.systolic_bp AS systolic_mmhg,
    v.diastolic_bp AS diastolic_mmhg,
    v.heart_rate AS heart_rate_bpm,
    v.respiratory_rate,
    v.temperature_c,
    v.oxygen_saturation AS spo2_pct,
    v.weight_kg,
    v.height_cm,
    v.bmi,
    v.waist_cm,
    v.blood_glucose AS blood_glucose_mg_dl,
    v.pain_score
FROM vital_signs v
JOIN encounters e ON e.id = v.encounter_id
WHERE v.voided_at IS NULL;

CREATE VIEW "analytics"."diagnoses" WITH (security_barrier = true) AS
SELECT
    d.id AS diagnosis_id,
    d.encounter_id,
    e.patient_id,
    e.started_at AS diagnosed_at,
    d.icd10_code,
    d.description AS display,
    analytics.icd10_chapter(d.icd10_code) AS icd10_chapter,
    lower(d.type::text) AS type,
    CASE WHEN d.is_final THEN 'confirmed' ELSE 'provisional' END AS certainty,
    d.type = 'PRIMARY' AS is_primary
FROM encounter_diagnoses d
JOIN encounters e ON e.id = d.encounter_id
WHERE d.voided_at IS NULL;

CREATE VIEW "analytics"."allergies" WITH (security_barrier = true) AS
SELECT
    a.id AS allergy_id,
    a.patient_id,
    a.allergen AS substance,
    lower(a.type::text) AS kind,
    a.reaction,
    lower(a.severity::text) AS severity,
    a.is_active,
    a.noted_at AS recorded_at
FROM patient_allergies a
WHERE a.voided_at IS NULL;

CREATE VIEW "analytics"."prescriptions" WITH (security_barrier = true) AS
SELECT
    rx.id AS prescription_id,
    rx.encounter_id,
    e.patient_id,
    pr.user_id AS prescriber_id,
    CASE WHEN rx.voided_at IS NOT NULL THEN 'voided' ELSE lower(rx.document_status::text) END AS status,
    lower(rx.status::text) AS dispense_status,
    CASE WHEN rx.document_status = 'ISSUED' THEN rx.issued_at END AS issued_at,
    rx.created_at
FROM prescriptions rx
JOIN encounters e ON e.id = rx.encounter_id
JOIN practitioners pr ON pr.id = rx.practitioner_id;

CREATE VIEW "analytics"."prescription_items" WITH (security_barrier = true) AS
SELECT
    i.id AS item_id,
    i.prescription_id,
    e.patient_id,
    CASE WHEN rx.voided_at IS NOT NULL THEN 'voided' ELSE lower(rx.document_status::text) END AS prescription_status,
    CASE WHEN rx.document_status = 'ISSUED' THEN rx.issued_at END AS issued_at,
    i.generic_name,
    i.brand_name,
    i.strength,
    i.dosage_form AS form,
    i.sig,
    i.route,
    i.frequency,
    i.duration_days,
    i.quantity
FROM prescription_items i
JOIN prescriptions rx ON rx.id = i.prescription_id
JOIN encounters e ON e.id = rx.encounter_id;

-- One row per ordered test (diagnostic order item).
CREATE VIEW "analytics"."orders" WITH (security_barrier = true) AS
SELECT
    i.id AS order_id,
    o.order_no,
    o.encounter_id,
    e.patient_id,
    t.code AS test_code,
    t.lis_code AS loinc_code,
    t.name AS test,
    lower(t.category::text) AS category,
    lower(o.priority::text) AS priority,
    lower(i.status::text) AS status,
    e.clinic_id AS facility_id,
    o.created_at
FROM diagnostic_order_items i
JOIN diagnostic_orders o ON o.id = i.order_id
JOIN encounters e ON e.id = o.encounter_id
JOIN diagnostic_tests t ON t.id = i.test_id;

-- One row per result value (analyte).
CREATE VIEW "analytics"."results" WITH (security_barrier = true) AS
SELECT
    v.id AS result_id,
    i.id AS order_id,
    e.patient_id,
    coalesce(p.lis_code, t.lis_code) AS loinc_code,
    v.name AS test,
    v.value,
    v.numeric_value AS value_numeric,
    v.unit,
    v.reference_range AS ref_range,
    lower(v.flag::text) AS flag,
    r.resulted_at,
    r.released_at,
    r.reviewed_at
FROM diagnostic_result_values v
JOIN diagnostic_results r ON r.id = v.result_id
JOIN diagnostic_order_items i ON i.id = r.order_item_id
JOIN diagnostic_orders o ON o.id = i.order_id
JOIN encounters e ON e.id = o.encounter_id
JOIN diagnostic_tests t ON t.id = i.test_id
LEFT JOIN diagnostic_test_parameters p ON p.id = v.parameter_id;

-- Invoices are the clinic's (no patient column, clinic-scoped policy); a visit's invoice is shown only when the user
-- may see the visit's patient, so a doctor's figures cover their own patients and the cashier's the whole clinic.
CREATE VIEW "analytics"."invoices" WITH (security_barrier = true) AS
SELECT
    inv.id AS invoice_id,
    inv.encounter_id,
    e.patient_id,
    inv.clinic_id AS facility_id,
    lower(inv.status::text) AS status,
    inv.gross_amount,
    inv.sc_pwd_discount,
    inv.other_discount,
    inv.vat_amount,
    inv.net_amount,
    inv.amount_paid,
    inv.balance,
    inv.invoice_date,
    inv.issued_at
FROM invoices inv
LEFT JOIN encounters e ON e.id = inv.encounter_id
WHERE inv.status <> 'VOID' AND (inv.encounter_id IS NULL OR e.id IS NOT NULL);

CREATE VIEW "analytics"."invoice_lines" WITH (security_barrier = true) AS
SELECT
    l.id AS line_id,
    l.invoice_id,
    coalesce(le.patient_id, ie.patient_id) AS patient_id,
    lower(s.category::text) AS category,
    l.description,
    s.code,
    l.quantity,
    l.unit_price,
    l.discount_amount,
    l.line_total
FROM invoice_lines l
JOIN invoices inv ON inv.id = l.invoice_id
LEFT JOIN service_items s ON s.id = l.service_item_id
LEFT JOIN encounters le ON le.id = l.encounter_id
LEFT JOIN encounters ie ON ie.id = inv.encounter_id
WHERE inv.status <> 'VOID' AND (inv.encounter_id IS NULL OR ie.id IS NOT NULL)
    AND (l.encounter_id IS NULL OR le.id IS NOT NULL);

DO $$
DECLARE
    v text;
BEGIN
    FOREACH v IN ARRAY ARRAY['patients', 'encounters', 'vitals', 'diagnoses', 'allergies', 'prescriptions',
        'prescription_items', 'orders', 'results', 'invoices', 'invoice_lines']
    LOOP
        EXECUTE format('ALTER VIEW analytics.%I OWNER TO loopwise_analytics_owner', v);
        EXECUTE format('GRANT SELECT ON analytics.%I TO loopwise_analyst', v);
    END LOOP;
END
$$;

COMMENT ON SCHEMA "analytics" IS 'Read-only views of the clinical record, limited to the patients the signed-in user may see.';

COMMENT ON VIEW "analytics"."patients" IS 'One row per patient the user may see (their panel).';
COMMENT ON COLUMN "analytics"."patients"."patient_id" IS 'Patient id; joins every other view.';
COMMENT ON COLUMN "analytics"."patients"."name" IS 'First and last name.';
COMMENT ON COLUMN "analytics"."patients"."sex" IS 'female or male.';
COMMENT ON COLUMN "analytics"."patients"."birth_year" IS 'Year of birth.';
COMMENT ON COLUMN "analytics"."patients"."age_years" IS 'Age today, in whole years.';
COMMENT ON COLUMN "analytics"."patients"."age_band" IS 'Age group today: 0-4, 5-17, 18-39, 40-59, 60+.';
COMMENT ON COLUMN "analytics"."patients"."barangay" IS 'Barangay of the primary address, when recorded.';
COMMENT ON COLUMN "analytics"."patients"."preferred_language" IS 'Preferred language code (ceb, fil, en).';
COMMENT ON COLUMN "analytics"."patients"."has_consent" IS 'Whether a granted, unrevoked data-privacy consent (RA 10173) is on file.';
COMMENT ON COLUMN "analytics"."patients"."organization_id" IS 'Organization (clinic group) the patient is registered with.';
COMMENT ON COLUMN "analytics"."patients"."registered_at" IS 'When the patient was registered.';

COMMENT ON VIEW "analytics"."encounters" IS 'Visits of the visible patients.';
COMMENT ON COLUMN "analytics"."encounters"."facility_id" IS 'Clinic of the visit.';
COMMENT ON COLUMN "analytics"."encounters"."facility" IS 'Clinic name.';
COMMENT ON COLUMN "analytics"."encounters"."doctor_id" IS 'User id of the practitioner who saw the patient.';
COMMENT ON COLUMN "analytics"."encounters"."started_at" IS 'When the visit started (timestamptz).';
COMMENT ON COLUMN "analytics"."encounters"."type" IS 'consultation, follow_up, teleconsultation, procedure, peme, ape, konsulta_fpe, konsulta_visit, prenatal, well_baby, immunization, dental, emergency or lab_only.';
COMMENT ON COLUMN "analytics"."encounters"."status" IS 'open, in_progress, for_billing, completed or cancelled.';
COMMENT ON COLUMN "analytics"."encounters"."reason" IS 'Chief complaint.';
COMMENT ON COLUMN "analytics"."encounters"."follow_up_on" IS 'Follow-up date asked for, if any.';

COMMENT ON VIEW "analytics"."vitals" IS 'Vital signs taken at visits (voided readings excluded).';
COMMENT ON COLUMN "analytics"."vitals"."systolic_mmhg" IS 'Systolic blood pressure, mmHg.';
COMMENT ON COLUMN "analytics"."vitals"."diastolic_mmhg" IS 'Diastolic blood pressure, mmHg.';
COMMENT ON COLUMN "analytics"."vitals"."heart_rate_bpm" IS 'Heart rate, beats per minute.';
COMMENT ON COLUMN "analytics"."vitals"."spo2_pct" IS 'Oxygen saturation, %.';
COMMENT ON COLUMN "analytics"."vitals"."bmi" IS 'Body-mass index, kg/m².';
COMMENT ON COLUMN "analytics"."vitals"."blood_glucose_mg_dl" IS 'Capillary blood glucose, mg/dL.';
COMMENT ON COLUMN "analytics"."vitals"."pain_score" IS 'Pain score 0–10.';

COMMENT ON VIEW "analytics"."diagnoses" IS 'ICD-10 diagnoses recorded at visits (voided excluded).';
COMMENT ON COLUMN "analytics"."diagnoses"."icd10_code" IS 'ICD-10 (WHO) code, e.g. I10, E11.9.';
COMMENT ON COLUMN "analytics"."diagnoses"."icd10_chapter" IS 'ICD-10 chapter of the code, with its range.';
COMMENT ON COLUMN "analytics"."diagnoses"."type" IS 'primary, secondary, working or comorbidity.';
COMMENT ON COLUMN "analytics"."diagnoses"."certainty" IS 'confirmed (final) or provisional.';

COMMENT ON VIEW "analytics"."allergies" IS 'Recorded allergies (voided excluded).';
COMMENT ON COLUMN "analytics"."allergies"."kind" IS 'drug, food, environmental or other.';
COMMENT ON COLUMN "analytics"."allergies"."severity" IS 'mild, moderate or severe (null: not recorded).';

COMMENT ON VIEW "analytics"."prescriptions" IS 'Prescriptions written at visits.';
COMMENT ON COLUMN "analytics"."prescriptions"."status" IS 'draft, issued or voided.';
COMMENT ON COLUMN "analytics"."prescriptions"."dispense_status" IS 'active, partially_dispensed, dispensed, cancelled or expired.';

COMMENT ON VIEW "analytics"."prescription_items" IS 'Medicines on prescriptions, one row per item (generic name per RA 6675).';

COMMENT ON VIEW "analytics"."orders" IS 'Ordered lab and imaging tests, one row per test.';
COMMENT ON COLUMN "analytics"."orders"."loinc_code" IS 'LOINC code of the test (4548-4 HbA1c, 1558-6 fasting glucose), when mapped.';
COMMENT ON COLUMN "analytics"."orders"."status" IS 'requested, paid, specimen_collected, in_progress, resulted, released or cancelled.';

COMMENT ON VIEW "analytics"."results" IS 'Lab results, one row per analyte.';
COMMENT ON COLUMN "analytics"."results"."loinc_code" IS 'LOINC code of the analyte, when mapped.';
COMMENT ON COLUMN "analytics"."results"."flag" IS 'normal, low, high, abnormal, critical_low or critical_high.';
COMMENT ON COLUMN "analytics"."results"."reviewed_at" IS 'When a clinician reviewed it (null: awaiting review).';

COMMENT ON VIEW "analytics"."invoices" IS 'Invoices (voided excluded), in PHP; a visit''s invoice only when its patient is visible.';
COMMENT ON COLUMN "analytics"."invoices"."status" IS 'draft, issued, partially_paid or paid.';
COMMENT ON COLUMN "analytics"."invoices"."gross_amount" IS 'Total of the lines as charged (VAT included), PHP.';
COMMENT ON COLUMN "analytics"."invoices"."vat_amount" IS 'VAT (12%) in the VATable sales, PHP.';
COMMENT ON COLUMN "analytics"."invoices"."amount_paid" IS 'Payments allocated so far (cash, e-wallet, PhilHealth package …), PHP.';
COMMENT ON COLUMN "analytics"."invoices"."balance" IS 'Amount still due, PHP.';
COMMENT ON COLUMN "analytics"."invoices"."invoice_date" IS 'Invoice date (timestamptz).';
COMMENT ON COLUMN "analytics"."invoices"."sc_pwd_discount" IS 'Senior citizen / PWD discount (RA 9994 / RA 10754), PHP.';
COMMENT ON COLUMN "analytics"."invoices"."net_amount" IS 'Amount due after discounts, PHP.';

COMMENT ON VIEW "analytics"."invoice_lines" IS 'Lines of the invoices.';
COMMENT ON COLUMN "analytics"."invoice_lines"."category" IS 'Catalog category: consultation, laboratory, imaging, medicine, supply, certificate … (null: free-text line).';
COMMENT ON COLUMN "analytics"."invoice_lines"."discount_amount" IS 'Senior citizen / PWD VAT removed plus discount on the line, PHP.';
COMMENT ON COLUMN "analytics"."invoice_lines"."line_total" IS 'Line amount, PHP.';
