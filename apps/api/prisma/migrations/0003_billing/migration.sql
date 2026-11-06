-- Cashier completion (DESIGN.md §5.5): professional fee terms per clinic, the invoice's withholding rate, payment and
-- shift columns, one open shift per cashier, and the row-level security paths the billing admin needs. Additive only.

-- Professional fee terms of a doctor at a clinic: the expanded withholding tax rate (NULL = the 10% default) and the
-- clinic's share of the fee. Rates to be confirmed by the clinic's accountant.
ALTER TABLE "practitioner_clinics"
    ADD COLUMN "ewt_rate" DECIMAL(5,4),
    ADD COLUMN "clinic_share_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    ADD CONSTRAINT "practitioner_clinics_pf_rates" CHECK (
        (ewt_rate IS NULL OR (ewt_rate >= 0 AND ewt_rate <= 1)) AND clinic_share_rate >= 0 AND clinic_share_rate <= 1);

-- The creditable withholding tax rate a corporate buyer withholds (BIR 2307), kept to redraw the draft.
ALTER TABLE "invoices" ADD COLUMN "withholding_tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0;

-- The pharmacy's ledger rows (DISPENSE / RETURN_FROM_PATIENT) a line bills: `stock_movements` is append-only, so the
-- invoice line keeps them, and "Load charges" leaves out movements already on another invoice of the visit.
ALTER TABLE "invoice_lines" ADD COLUMN "stock_movement_ids" UUID[] NOT NULL DEFAULT '{}';

-- Who voided a payment, and when (the reason is required).
ALTER TABLE "payments"
    ADD COLUMN "voided_at" TIMESTAMPTZ(3),
    ADD COLUMN "voided_by_id" UUID,
    ADD CONSTRAINT "payments_void_reason" CHECK (status <> 'VOIDED' OR void_reason IS NOT NULL);

-- Who closed a shift (the Z reading); one open shift per cashier per clinic.
ALTER TABLE "cashier_shifts" ADD COLUMN "closed_by_id" UUID;
CREATE UNIQUE INDEX "cashier_shifts_one_open" ON "cashier_shifts" ("clinic_id", "cashier_id") WHERE closed_at IS NULL;
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_closed" CHECK (
    closed_at IS NULL OR (counted_cash IS NOT NULL AND expected_cash IS NOT NULL AND variance IS NOT NULL));

-- A professional fee of a voided invoice is cancelled, never deleted; who released it.
ALTER TYPE "pf_status" ADD VALUE 'CANCELLED';
ALTER TABLE "professional_fees" ADD COLUMN "released_by_id" UUID;

-- The clinic of a visit, for policies on rows of a visit whose patient the user may not see (billing admins).
CREATE FUNCTION "app_encounter_clinic_id"(p_encounter_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT clinic_id FROM encounters WHERE id = p_encounter_id
$$;

-- Professional fees: the doctor sees their own; the clinic's admins and billing desk see and write the clinic's (a
-- clinic admin releases fees of visits whose patient they don't see).
DROP POLICY "professional_fees_access" ON "professional_fees";
CREATE POLICY "professional_fees_access" ON "professional_fees" TO loopwise_app
    USING (
        EXISTS (SELECT 1 FROM practitioners p WHERE p.id = practitioner_id AND p.user_id = app_user_id())
        OR (encounter_id IS NOT NULL AND app_encounter_clinic_id(encounter_id) = ANY (app_clinic_ids_with_role(
            ARRAY['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'BILLING_CLERK']::staff_role[])))
    )
    WITH CHECK (
        encounter_id IS NOT NULL AND (
            app_can_write_encounter(encounter_id)
            OR app_encounter_clinic_id(encounter_id) = ANY (app_clinic_ids_with_role(
                ARRAY['SUPER_ADMIN', 'ADMIN', 'CASHIER', 'BILLING_CLERK']::staff_role[])))
    );

-- Invoices: a clinic admin may also void an invoice of a visit whose patient they don't see.
DROP POLICY "invoices_access" ON "invoices";
CREATE POLICY "invoices_access" ON "invoices" TO loopwise_app
    USING (clinic_id = ANY (app_clinic_ids()))
    WITH CHECK (clinic_id = ANY (app_clinic_ids()) AND (encounter_id IS NULL OR app_can_write_encounter(encounter_id)
        OR clinic_id = ANY (app_clinic_ids_with_role(ARRAY['SUPER_ADMIN', 'ADMIN']::staff_role[]))));
