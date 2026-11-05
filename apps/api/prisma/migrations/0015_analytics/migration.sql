-- Safe analytics for Wise (DESIGN.md §7.2, §8.2): curated read-only views of the clinical tables that Wise may query
-- with SQL, as the signed-in user and nothing more.
--
-- Layers, each enforced by Postgres even if the API's SQL validator misses something:
-- 1. `loopwise_analyst` is its own LOGIN role on its own connection pool. It holds SELECT on `analytics.*` and EXECUTE
--    on `analytics.bind`, nothing on the base tables, and has no other role to switch to (it never runs inside the
--    superuser session, so `RESET ROLE` / `set_config('role', …)` lead nowhere).
-- 2. The views are owned by `loopwise_analytics_owner` (a member of `loopwise_app`, NOBYPASSRLS) and are not
--    `security_invoker`: they read the base tables as that owner, so every row still passes the RLS policies of 0006
--    and 0011, evaluated for the bound user.
-- 3. The user is bound per transaction by `analytics.bind(token)`: a one-time token the API issued as the system
--    user, consumed here and recorded against the transaction id in `app_private`, which neither role can reach.
--    `app_user_id()` prefers that record and, for the analyst, ignores the `app.user_id` setting, so
--    `set_config('app.user_id', …)` can't impersonate anyone. The `asUser` path (GUC + `loopwise_app`) is unchanged.
-- 4. The API runs each query read-only, with a statement timeout and a row cap (see `analytics.repository.ts`).

ALTER TABLE "patient" ADD COLUMN "barangay" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loopwise_analytics_owner') THEN
        CREATE ROLE loopwise_analytics_owner NOLOGIN NOBYPASSRLS INHERIT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'loopwise_analyst') THEN
        -- Synthetic development password; deployments set their own (ANALYTICS_DATABASE_URL).
        CREATE ROLE loopwise_analyst LOGIN NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE PASSWORD 'loopwise_analyst';
    END IF;
END
$$;

GRANT loopwise_app TO loopwise_analytics_owner;
GRANT loopwise_analytics_owner TO CURRENT_USER;
ALTER ROLE loopwise_analyst SET statement_timeout = '5s';
ALTER ROLE loopwise_analyst SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE loopwise_analyst SET work_mem = '16MB';
ALTER ROLE loopwise_analyst SET search_path = analytics;

-- The analyst sees no table of `public`. (Functions in `public` stay executable by PUBLIC, as Postgres has it; the
-- ones that matter read the bound identity.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM loopwise_analyst;

-- Analyst sessions share one role, so the activity view would show one doctor another doctor's SQL text. Nothing in
-- Loopwise reads it as a non-superuser.
REVOKE SELECT ON pg_catalog.pg_stat_activity FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_catalog.pg_stat_get_activity(integer) FROM PUBLIC;

-- Identity binding, out of reach of both roles.
CREATE SCHEMA "app_private";
REVOKE ALL ON SCHEMA "app_private" FROM PUBLIC;

CREATE TABLE "app_private"."analytics_grant" (
    "token_hash" TEXT PRIMARY KEY,
    "user_id"    TEXT NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL
);

CREATE TABLE "app_private"."analytics_identity" (
    "xact_id"    XID8 PRIMARY KEY,
    "user_id"    TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION "app_user_id"() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce(
        (SELECT i.user_id FROM app_private.analytics_identity i WHERE i.xact_id = pg_current_xact_id_if_assigned()),
        CASE WHEN session_user = 'loopwise_analyst' THEN NULL
             ELSE nullif(current_setting('app.user_id', true), '') END
    )
$$;

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
    v_user_id text;
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

-- The views. Owned by `loopwise_analytics_owner` (RLS applies), `security_barrier` so no user predicate runs before
-- the view's own. No phone numbers, no MRN or PhilHealth numbers, no free-text notes beyond the visit reason.
CREATE VIEW "analytics"."patients" WITH (security_barrier = true) AS
SELECT
    p.id AS patient_id,
    p.given_name || ' ' || p.family_name AS name,
    p.sex::text AS sex,
    extract(year FROM p.birth_date)::int AS birth_year,
    extract(year FROM age(current_date, p.birth_date))::int AS age_years,
    CASE
        WHEN age(current_date, p.birth_date) < interval '5 years' THEN '0-4'
        WHEN age(current_date, p.birth_date) < interval '18 years' THEN '5-17'
        WHEN age(current_date, p.birth_date) < interval '40 years' THEN '18-39'
        WHEN age(current_date, p.birth_date) < interval '60 years' THEN '40-59'
        ELSE '60+'
    END AS age_band,
    p.barangay,
    p.preferred_language,
    p.consent_at IS NOT NULL AS has_consent,
    p.created_at AS registered_at
FROM patient p;

CREATE VIEW "analytics"."encounters" WITH (security_barrier = true) AS
SELECT
    e.id AS encounter_id,
    e.patient_id,
    e.org_id AS facility_id,
    o.name AS facility,
    e.doctor_id,
    e.started_at,
    e.reason,
    e.follow_up_on
FROM encounter e
JOIN organization o ON o.id = e.org_id;

CREATE VIEW "analytics"."vitals" WITH (security_barrier = true) AS
SELECT
    v.id AS vitals_id,
    v.encounter_id,
    v.patient_id,
    v.recorded_at,
    v.systolic_mmhg,
    v.diastolic_mmhg,
    v.heart_rate_bpm,
    v.respiratory_rate,
    v.temperature_c,
    v.spo2_pct,
    v.weight_kg,
    v.height_cm,
    v.bmi,
    v.blood_glucose_mg_dl,
    v.pain_score
FROM vital_signs v
WHERE v.voided_at IS NULL;

CREATE VIEW "analytics"."diagnoses" WITH (security_barrier = true) AS
SELECT
    d.id AS diagnosis_id,
    d.encounter_id,
    d.patient_id,
    e.started_at AS diagnosed_at,
    d.icd10_code,
    d.display,
    analytics.icd10_chapter(d.icd10_code) AS icd10_chapter,
    d.certainty::text AS certainty,
    d.is_primary
FROM encounter_diagnosis d
JOIN encounter e ON e.id = d.encounter_id
WHERE d.voided_at IS NULL;

CREATE VIEW "analytics"."allergies" WITH (security_barrier = true) AS
SELECT
    a.id AS allergy_id,
    a.patient_id,
    a.substance,
    a.kind::text AS kind,
    a.reaction,
    a.severity::text AS severity,
    a.created_at AS recorded_at
FROM patient_allergy a
WHERE a.voided_at IS NULL;

CREATE VIEW "analytics"."prescriptions" WITH (security_barrier = true) AS
SELECT
    rx.id AS prescription_id,
    rx.encounter_id,
    rx.patient_id,
    rx.prescriber_id,
    rx.status::text AS status,
    rx.issued_at,
    rx.created_at
FROM prescription rx;

CREATE VIEW "analytics"."prescription_items" WITH (security_barrier = true) AS
SELECT
    i.id AS item_id,
    i.prescription_id,
    rx.patient_id,
    rx.status::text AS prescription_status,
    rx.issued_at,
    i.generic_name,
    i.brand_name,
    i.strength,
    i.form,
    i.dose,
    i.route::text AS route,
    i.frequency,
    i.duration_days,
    i.quantity
FROM prescription_item i
JOIN prescription rx ON rx.id = i.prescription_id;

CREATE VIEW "analytics"."orders" WITH (security_barrier = true) AS
SELECT
    o.id AS order_id,
    o.encounter_id,
    o.patient_id,
    o.code AS loinc_code,
    o.display AS test,
    o.priority::text AS priority,
    o.status::text AS status,
    o.ordering_org_id AS facility_id,
    o.target_org_id,
    o.sent_at,
    o.created_at
FROM clinical_order o;

CREATE VIEW "analytics"."results" WITH (security_barrier = true) AS
SELECT
    r.id AS result_id,
    r.order_id,
    r.patient_id,
    r.code AS loinc_code,
    r.display AS test,
    r.value,
    r.value_numeric,
    r.unit,
    r.ref_range,
    r.flag::text AS flag,
    r.resulted_at,
    r.reviewed_at
FROM result r;

CREATE VIEW "analytics"."bills" WITH (security_barrier = true) AS
SELECT
    b.id AS bill_id,
    b.encounter_id,
    b.patient_id,
    b.org_id AS facility_id,
    b.status::text AS status,
    b.subtotal,
    b.discount_kind::text AS discount_kind,
    b.discount_amount,
    b.philhealth_coverage,
    b.total,
    b.finalized_at,
    b.paid_at,
    b.created_at
FROM encounter_bill b
WHERE b.voided_at IS NULL;

CREATE VIEW "analytics"."bill_charges" WITH (security_barrier = true) AS
SELECT
    c.id AS charge_id,
    c.bill_id,
    b.patient_id,
    c.kind::text AS kind,
    c.description,
    c.code,
    c.quantity,
    c.unit_price,
    c.amount
FROM encounter_charge c
JOIN encounter_bill b ON b.id = c.bill_id
WHERE b.voided_at IS NULL;

DO $$
DECLARE
    v text;
BEGIN
    FOREACH v IN ARRAY ARRAY['patients', 'encounters', 'vitals', 'diagnoses', 'allergies', 'prescriptions',
        'prescription_items', 'orders', 'results', 'bills', 'bill_charges']
    LOOP
        EXECUTE format('ALTER VIEW analytics.%I OWNER TO loopwise_analytics_owner', v);
        EXECUTE format('GRANT SELECT ON analytics.%I TO loopwise_analyst', v);
    END LOOP;
END
$$;

COMMENT ON SCHEMA "analytics" IS 'Read-only views of the clinical record, limited to the patients the signed-in user may see.';

COMMENT ON VIEW "analytics"."patients" IS 'One row per patient the user may see (their panel).';
COMMENT ON COLUMN "analytics"."patients"."patient_id" IS 'Patient id; joins every other view.';
COMMENT ON COLUMN "analytics"."patients"."name" IS 'Given and family name.';
COMMENT ON COLUMN "analytics"."patients"."sex" IS 'female, male, other or unknown.';
COMMENT ON COLUMN "analytics"."patients"."birth_year" IS 'Year of birth.';
COMMENT ON COLUMN "analytics"."patients"."age_years" IS 'Age today, in whole years.';
COMMENT ON COLUMN "analytics"."patients"."age_band" IS 'Age group today: 0-4, 5-17, 18-39, 40-59, 60+.';
COMMENT ON COLUMN "analytics"."patients"."barangay" IS 'Barangay of residence, when recorded.';
COMMENT ON COLUMN "analytics"."patients"."preferred_language" IS 'Preferred language code (ceb, fil, en).';
COMMENT ON COLUMN "analytics"."patients"."has_consent" IS 'Whether consent to care and messaging is recorded.';
COMMENT ON COLUMN "analytics"."patients"."registered_at" IS 'When the patient was registered in Loopwise.';

COMMENT ON VIEW "analytics"."encounters" IS 'Visits (consultations) of the visible patients.';
COMMENT ON COLUMN "analytics"."encounters"."encounter_id" IS 'Encounter id.';
COMMENT ON COLUMN "analytics"."encounters"."patient_id" IS 'Patient seen.';
COMMENT ON COLUMN "analytics"."encounters"."facility_id" IS 'Facility of the visit.';
COMMENT ON COLUMN "analytics"."encounters"."facility" IS 'Facility name.';
COMMENT ON COLUMN "analytics"."encounters"."doctor_id" IS 'Clinician who saw the patient (user id).';
COMMENT ON COLUMN "analytics"."encounters"."started_at" IS 'When the visit started (UTC).';
COMMENT ON COLUMN "analytics"."encounters"."reason" IS 'Reason for the visit (chief complaint).';
COMMENT ON COLUMN "analytics"."encounters"."follow_up_on" IS 'Follow-up date asked for, if any.';

COMMENT ON VIEW "analytics"."vitals" IS 'Vital signs taken at visits (voided readings excluded).';
COMMENT ON COLUMN "analytics"."vitals"."recorded_at" IS 'When the vitals were taken (UTC).';
COMMENT ON COLUMN "analytics"."vitals"."systolic_mmhg" IS 'Systolic blood pressure, mmHg.';
COMMENT ON COLUMN "analytics"."vitals"."diastolic_mmhg" IS 'Diastolic blood pressure, mmHg.';
COMMENT ON COLUMN "analytics"."vitals"."heart_rate_bpm" IS 'Heart rate, beats per minute.';
COMMENT ON COLUMN "analytics"."vitals"."respiratory_rate" IS 'Breaths per minute.';
COMMENT ON COLUMN "analytics"."vitals"."temperature_c" IS 'Temperature, °C.';
COMMENT ON COLUMN "analytics"."vitals"."spo2_pct" IS 'Oxygen saturation, %.';
COMMENT ON COLUMN "analytics"."vitals"."weight_kg" IS 'Weight, kg.';
COMMENT ON COLUMN "analytics"."vitals"."height_cm" IS 'Height, cm.';
COMMENT ON COLUMN "analytics"."vitals"."bmi" IS 'Body-mass index, kg/m².';
COMMENT ON COLUMN "analytics"."vitals"."blood_glucose_mg_dl" IS 'Capillary blood glucose, mg/dL.';
COMMENT ON COLUMN "analytics"."vitals"."pain_score" IS 'Pain score 0–10.';

COMMENT ON VIEW "analytics"."diagnoses" IS 'ICD-10 diagnoses recorded at visits (voided excluded).';
COMMENT ON COLUMN "analytics"."diagnoses"."diagnosed_at" IS 'Start of the visit the diagnosis was recorded at.';
COMMENT ON COLUMN "analytics"."diagnoses"."icd10_code" IS 'ICD-10 (WHO) code, e.g. I10, E11.9.';
COMMENT ON COLUMN "analytics"."diagnoses"."display" IS 'Diagnosis name.';
COMMENT ON COLUMN "analytics"."diagnoses"."icd10_chapter" IS 'ICD-10 chapter of the code, with its range.';
COMMENT ON COLUMN "analytics"."diagnoses"."certainty" IS 'provisional or confirmed.';
COMMENT ON COLUMN "analytics"."diagnoses"."is_primary" IS 'The primary diagnosis of the visit.';

COMMENT ON VIEW "analytics"."allergies" IS 'Recorded allergies (voided excluded).';
COMMENT ON COLUMN "analytics"."allergies"."substance" IS 'Allergen.';
COMMENT ON COLUMN "analytics"."allergies"."kind" IS 'drug, food, environment or other.';
COMMENT ON COLUMN "analytics"."allergies"."severity" IS 'mild, moderate or severe (null: not recorded).';

COMMENT ON VIEW "analytics"."prescriptions" IS 'Prescriptions written at visits.';
COMMENT ON COLUMN "analytics"."prescriptions"."status" IS 'draft, issued or voided.';
COMMENT ON COLUMN "analytics"."prescriptions"."issued_at" IS 'When it was issued (null for drafts).';

COMMENT ON VIEW "analytics"."prescription_items" IS 'Medicines on prescriptions, one row per item.';
COMMENT ON COLUMN "analytics"."prescription_items"."prescription_status" IS 'Status of the prescription: draft, issued or voided.';
COMMENT ON COLUMN "analytics"."prescription_items"."generic_name" IS 'Generic name of the medicine.';
COMMENT ON COLUMN "analytics"."prescription_items"."frequency" IS 'How often, as written (e.g. once a day).';
COMMENT ON COLUMN "analytics"."prescription_items"."duration_days" IS 'Days of treatment.';

COMMENT ON VIEW "analytics"."orders" IS 'Lab and imaging orders.';
COMMENT ON COLUMN "analytics"."orders"."loinc_code" IS 'LOINC code of the test (4548-4 HbA1c, 1558-6 fasting glucose).';
COMMENT ON COLUMN "analytics"."orders"."status" IS 'draft, sent, accepted, collected, resulted, reviewed or cancelled.';
COMMENT ON COLUMN "analytics"."orders"."facility_id" IS 'Ordering facility.';
COMMENT ON COLUMN "analytics"."orders"."sent_at" IS 'When the order was sent to the lab.';

COMMENT ON VIEW "analytics"."results" IS 'Lab and imaging results.';
COMMENT ON COLUMN "analytics"."results"."loinc_code" IS 'LOINC code of the test.';
COMMENT ON COLUMN "analytics"."results"."value" IS 'Result as reported (text).';
COMMENT ON COLUMN "analytics"."results"."value_numeric" IS 'Numeric value, when the result is a number.';
COMMENT ON COLUMN "analytics"."results"."flag" IS 'normal, low, high, abnormal, critical_low or critical_high.';
COMMENT ON COLUMN "analytics"."results"."resulted_at" IS 'When the lab resulted it.';
COMMENT ON COLUMN "analytics"."results"."reviewed_at" IS 'When a clinician reviewed it (null: awaiting review).';

COMMENT ON VIEW "analytics"."bills" IS 'Visit bills (voided excluded), in PHP.';
COMMENT ON COLUMN "analytics"."bills"."status" IS 'draft, finalized or paid.';
COMMENT ON COLUMN "analytics"."bills"."total" IS 'Amount due after discounts and PhilHealth, PHP.';
COMMENT ON COLUMN "analytics"."bills"."philhealth_coverage" IS 'PhilHealth package coverage, PHP.';

COMMENT ON VIEW "analytics"."bill_charges" IS 'Lines of the bills.';
COMMENT ON COLUMN "analytics"."bill_charges"."kind" IS 'consultation, procedure, laboratory, imaging, medicine, supply or other.';
COMMENT ON COLUMN "analytics"."bill_charges"."amount" IS 'Line amount, PHP.';
