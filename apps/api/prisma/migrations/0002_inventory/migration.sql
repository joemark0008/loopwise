-- Pharmacy and inventory (DESIGN.md §5.5, §8). Additive only: no table changes, the reference's inventory tables of
-- 0000_init are used as they are.
--   1. the pharmacy desk reaches the patients, visits and issued prescriptions it dispenses
--   2. check constraints that keep the stock ledger sound

-- =====================================================================================================================
-- 1. Row-level security: the pharmacy desk
-- =====================================================================================================================

-- The pharmacy desk of a clinic (PHARMACIST, PHARMACY_ASSISTANT; its ADMIN / SUPER_ADMIN) sees a visit, and its patient,
-- only through an issued prescription of that visit at that clinic: what it needs to dispense (the patient's name and
-- allergies, the Rx), nothing else of the chart. SECURITY DEFINER (as the helpers of 0001), so the policies below don't
-- recurse through each other.
CREATE FUNCTION "app_pharmacy_can_see_encounter"(p_encounter_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM encounters e JOIN prescriptions p ON p.encounter_id = e.id
        WHERE e.id = p_encounter_id
            AND p.document_status = 'ISSUED'
            AND e.clinic_id = ANY (app_clinic_ids_with_role(
                ARRAY['PHARMACIST', 'PHARMACY_ASSISTANT', 'ADMIN', 'SUPER_ADMIN']::staff_role[]))
    )
$$;

CREATE FUNCTION "app_pharmacy_can_see_patient"(p_patient_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM encounters e JOIN prescriptions p ON p.encounter_id = e.id
        WHERE e.patient_id = p_patient_id
            AND p.document_status = 'ISSUED'
            AND e.clinic_id = ANY (app_clinic_ids_with_role(
                ARRAY['PHARMACIST', 'PHARMACY_ASSISTANT', 'ADMIN', 'SUPER_ADMIN']::staff_role[]))
    )
$$;

-- Permissive policies add to the ones of 0001 (a row passes when any policy passes).
CREATE POLICY "patients_pharmacy_read" ON "patients" FOR SELECT TO loopwise_app
    USING (app_pharmacy_can_see_patient(id));

CREATE POLICY "patient_allergies_pharmacy_read" ON "patient_allergies" FOR SELECT TO loopwise_app
    USING (app_pharmacy_can_see_patient(patient_id));

CREATE POLICY "encounters_pharmacy_read" ON "encounters" FOR SELECT TO loopwise_app
    USING (app_pharmacy_can_see_encounter(id));

-- Issued prescriptions: read, and updated by dispensing (the `prescriptions_lock` trigger lets only the status move;
-- `prescription_items_lock` only `dispensed_qty` and `inventory_item_id`). Items follow their prescription (0001).
CREATE POLICY "prescriptions_pharmacy_read" ON "prescriptions" FOR SELECT TO loopwise_app
    USING (document_status = 'ISSUED' AND app_pharmacy_can_see_encounter(encounter_id));

CREATE POLICY "prescriptions_pharmacy_dispense" ON "prescriptions" FOR UPDATE TO loopwise_app
    USING (document_status = 'ISSUED' AND app_pharmacy_can_see_encounter(encounter_id))
    WITH CHECK (document_status = 'ISSUED' AND app_pharmacy_can_see_encounter(encounter_id));

-- =====================================================================================================================
-- 2. Check constraints
-- =====================================================================================================================

-- A lot never goes below zero; every ledger row moves stock; nothing is dispensed beyond what was prescribed.
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_quantity_on_hand_check" CHECK (quantity_on_hand >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_check" CHECK (quantity <> 0);
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_quantity_check" CHECK (quantity > 0);
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_dispensed_qty_check"
    CHECK (dispensed_qty >= 0 AND dispensed_qty <= quantity);
