-- Row-level security on the clinical tables (DESIGN.md §10.2).
--
-- The app connects as the database owner (a superuser in development), which row-level security never restricts.
-- User-scoped work therefore runs in a transaction that sets `app.user_id` and switches to `loopwise_app`
-- (`SET LOCAL ROLE`, see apps/api/src/clinical/rls/clinical-db.service.ts); the policies below apply to that role.
-- System work (HL7 ingest, jobs, patient registration) keeps the connection's role and writes its own audit rows.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loopwise_app') THEN
        CREATE ROLE loopwise_app NOLOGIN NOBYPASSRLS;
    END IF;
END
$$;

GRANT loopwise_app TO CURRENT_USER;

-- Grants: clinical data is never deleted by users; history tables only grow; grants of access are system work.
GRANT USAGE ON SCHEMA public TO loopwise_app;
GRANT SELECT ON "organization", "user" TO loopwise_app;
GRANT SELECT, INSERT, UPDATE ON
    "patient", "patient_identifier", "encounter", "clinical_order", "result", "care_case", "referral", "task",
    "evidence", "patient_message"
    TO loopwise_app;
GRANT SELECT, INSERT ON "case_event", "audit_log" TO loopwise_app;
GRANT SELECT ON "care_relationship", "pathway" TO loopwise_app;

-- Helpers. SECURITY DEFINER: they run as the owner, so they read across the policies (no policy recursion).

CREATE FUNCTION "app_user_id"() RETURNS text
LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('app.user_id', true), '')
$$;

CREATE FUNCTION "app_org_ids"() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(array_agg(m.org_id), '{}') FROM org_member m WHERE m.user_id = app_user_id()
$$;

-- A user sees a patient through their own unexpired care relationship, or because the patient reached one of their
-- facilities: an order sent to it, a case it owns, or a referral to it.
CREATE FUNCTION "app_can_see_patient"(p_patient_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
            SELECT 1 FROM care_relationship r
            WHERE r.patient_id = p_patient_id AND r.user_id = app_user_id()
                AND (r.expires_at IS NULL OR r.expires_at > now())
        )
        OR EXISTS (
            SELECT 1 FROM clinical_order o
            WHERE o.patient_id = p_patient_id AND o.status <> 'draft' AND o.target_org_id = ANY (app_org_ids())
        )
        OR EXISTS (
            SELECT 1 FROM care_case c
            WHERE c.patient_id = p_patient_id AND c.owner_org_id = ANY (app_org_ids())
        )
        OR EXISTS (
            SELECT 1 FROM referral f JOIN care_case c ON c.id = f.case_id
            WHERE c.patient_id = p_patient_id AND f.status <> 'cancelled' AND f.to_org_id = ANY (app_org_ids())
        )
$$;

CREATE FUNCTION "app_can_see_case"(p_case_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
            SELECT 1 FROM care_case c
            WHERE c.id = p_case_id AND (c.owner_org_id = ANY (app_org_ids()) OR app_can_see_patient(c.patient_id))
        )
        OR EXISTS (
            SELECT 1 FROM referral f
            WHERE f.case_id = p_case_id AND f.status <> 'cancelled' AND f.to_org_id = ANY (app_org_ids())
        )
$$;

-- Policies. ENABLE (not FORCE): the owner keeps full access for system work.

ALTER TABLE "patient" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_access" ON "patient" TO loopwise_app
    USING (app_can_see_patient(id)) WITH CHECK (app_can_see_patient(id));

ALTER TABLE "patient_identifier" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_identifier_access" ON "patient_identifier" TO loopwise_app
    USING (app_can_see_patient(patient_id)) WITH CHECK (app_can_see_patient(patient_id));

ALTER TABLE "care_relationship" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "care_relationship_own" ON "care_relationship" FOR SELECT TO loopwise_app
    USING (user_id = app_user_id());

ALTER TABLE "encounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_access" ON "encounter" TO loopwise_app
    USING (app_can_see_patient(patient_id))
    WITH CHECK (app_can_see_patient(patient_id) AND org_id = ANY (app_org_ids()));

ALTER TABLE "clinical_order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinical_order_access" ON "clinical_order" TO loopwise_app
    USING (app_can_see_patient(patient_id) OR target_org_id = ANY (app_org_ids()))
    WITH CHECK (ordering_org_id = ANY (app_org_ids()) OR target_org_id = ANY (app_org_ids()));

ALTER TABLE "result" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "result_access" ON "result" TO loopwise_app
    USING (app_can_see_patient(patient_id) OR source_org_id = ANY (app_org_ids()))
    WITH CHECK (app_can_see_patient(patient_id) OR source_org_id = ANY (app_org_ids()));

ALTER TABLE "pathway" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pathway_read" ON "pathway" FOR SELECT TO loopwise_app USING (true);

ALTER TABLE "care_case" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "care_case_read" ON "care_case" FOR SELECT TO loopwise_app USING (app_can_see_case(id));
CREATE POLICY "care_case_insert" ON "care_case" FOR INSERT TO loopwise_app
    WITH CHECK (owner_org_id = ANY (app_org_ids()));
CREATE POLICY "care_case_update" ON "care_case" FOR UPDATE TO loopwise_app
    USING (app_can_see_case(id)) WITH CHECK (owner_org_id = ANY (app_org_ids()) OR app_can_see_case(id));

ALTER TABLE "case_event" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case_event_access" ON "case_event" TO loopwise_app
    USING (app_can_see_case(case_id)) WITH CHECK (app_can_see_case(case_id));

ALTER TABLE "referral" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referral_access" ON "referral" TO loopwise_app
    USING (app_can_see_case(case_id) OR from_org_id = ANY (app_org_ids()) OR to_org_id = ANY (app_org_ids()))
    WITH CHECK (app_can_see_case(case_id) OR from_org_id = ANY (app_org_ids()) OR to_org_id = ANY (app_org_ids()));

ALTER TABLE "task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_access" ON "task" TO loopwise_app
    USING (owner_user_id = app_user_id() OR owner_org_id = ANY (app_org_ids()) OR app_can_see_case(case_id))
    WITH CHECK (owner_user_id = app_user_id() OR owner_org_id = ANY (app_org_ids()) OR app_can_see_case(case_id));

ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_access" ON "evidence" TO loopwise_app
    USING (app_can_see_case(case_id))
    WITH CHECK (app_can_see_case(case_id) AND recorded_by_org_id = ANY (app_org_ids()));

ALTER TABLE "patient_message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_message_access" ON "patient_message" TO loopwise_app
    USING (app_can_see_patient(patient_id)) WITH CHECK (app_can_see_patient(patient_id));

ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_own" ON "audit_log" TO loopwise_app
    USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
