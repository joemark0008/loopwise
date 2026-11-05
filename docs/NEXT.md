# Next steps (handoff)

Where the Loopwise work stands, so any session can pick it up. The product is an AI-powered clinic system
([PLAN.md](PLAN.md)); the technical design is [DESIGN.md](DESIGN.md). Branch: `main` (the user's servers run from it on
:5006 / :3000; feature work merges in through an `integration` worktree).

## What's built

All on `main`. Section numbers refer to [DESIGN.md](DESIGN.md).

- **Local stack:** `docker compose up -d --wait` → `loopwise_postgres` on :5435, databases `loopwise` /
  `loopwise_test`. `npm run db:deploy -w @loopwise/api` then `npm run db:seed -w @loopwise/api`.
- **Data model (§5):** the PH clinic reference schema (`docs/schema-reference/clinic-prisma-schema/`, verbatim),
  adopted nearly as-is in Phase 0 (below). Migrations `0000_init` + `0001_rls_and_triggers`.
- **API structure (§4.5):** one module per domain under `apps/api/src/clinical/`, domain errors with stable codes,
  `AuditService`, request correlation ids, `DocumentSequenceService`.
- **Access (§8):** row-level security through care relationships, desk and lab roles per clinic
  (`ClinicalDbService.asUser` / `asSystem`), staff roles per clinic (`user_clinic_roles`), append-only audit.
- **Patients:** registration with an organization MRN, data-privacy consent and duplicate checks, contact and address
  updates, allergies, IDs (`clinical/patients/`, `apps/shared/src/patient-registration.ts`, `/patients`).
- **Practitioners:** the practitioner profile (PRC, PTR, S2, PhilHealth PAN) on Settings → Account; it signs documents.
- **Encounters (§5.1):** visit number, type, status transitions, SOAP note, vitals, ICD-10 diagnoses, the chart and
  the encounter page with tabs, print views; prescriptions (RA 6675, RA 9165) and medical certificates (draft, issue,
  void), referrals (API only).
- **In-house lab:** catalog, orders, the lab worklist (`/orders`: collect, enter results, release), results inbox
  (`/results`) and the chart's Results tab (`clinical/diagnostics/`).
- **Cashier:** invoices with SC/PWD discounts and the VAT split, BIR invoice series, payments (incl. PhilHealth package
  as a PHILHEALTH payment), void; the encounter's Billing tab (`clinical/billing/`).
- **Wise (§7):** proposal cards settled once with versions (`clinical/wise-proposals/`), Wise actions and tool settings
  per organization, navigation (`find_patient`, `open_page`), charts and summary reports (`clinical/insights/`), safe
  analytics SQL (`clinical/analytics/`), reports in a side panel saved to the chart (`clinical/reports/`), the reports
  library (`/reports`), reading attached files with OCR.
- **UX:** clinical design system ([design-system.md](design-system.md)), the desk navigation from the user's staff
  roles (doctor, nurse, lab, front desk, cashier; admins can open every desk), Today at `/`, Wise chats at `/chats`,
  Wise dock on list pages, a11y tests (`e2e/a11y.spec.ts`).

## Phase 0: the clinic schema (5 Nov 2026)

The database now follows the PH clinic reference schema. What changed, for anyone reading older code or notes:

- **Conventions:** plural snake_case tables, UPPERCASE enum values, UUIDv7 ids everywhere (better-auth generates
  UUIDv7; the web client generates UUID chat message ids), `timestamptz(3)`. The reference's Branch is `Clinic`.
- **Organization and clinics:** an organization (clinic group) owns its patients and catalogs; a clinic (branch) has its
  code, BIR / DOH / PhilHealth details and numbering, and is also the Wise workspace. Staff hold roles per clinic
  (`StaffRole`, plus MEMBER / VIEWER / CONTEXT_ADMIN for access) and optionally an organization role (`OrgRole`). The
  `project*` database names and stored values are gone (`clinics`, `clinic_id`, `shared_chats.visibility = 'clinic'`,
  `clinicSharing`, `clinicPreferences`, `./clinics`, `clinics/<id>/` storage keys) with their translation shims.
- **Encounter-centric:** every clinical record hangs off an encounter; children keep only `encounter_id` and RLS goes
  through the encounter (DESIGN.md §5.1 lists required / optional / patient-level tables).
- **Removed:** the HL7 ingest and outbox, facility API keys and cross-organization ordering (labs are in-house); the
  follow-up engine (pathways, rules engine, result evaluations, care cases, case events, tasks, evidence, patient
  messages, case referrals, clinical events, `explain_result`, the `/pathways`, `/cases`, `/worklist`, `/referrals`,
  `/dashboard` and patient cases / messages pages); EncounterBill / EncounterCharge (now Invoice); ClinicalOrder /
  Result (now the diagnostics models); ClinicianProfile (now Practitioner); PatientIdentifier and `consentAt` (now
  PatientIdentification and PatientConsent); `Organization.type` and facility types.
- **Seeded logins** (password `test1234`, organization `tagbilaran-hc`, clinic TAG "Tagbilaran City Health Center"):
  `test@test.test` (org ADMIN; SUPER_ADMIN, ADMIN, DOCTOR; practitioner), `dr.reyes@loopwise.test` (DOCTOR),
  `dr.cruz@loopwise.test` (DOCTOR, internal medicine), `nurse.santos@loopwise.test` (NURSE),
  `lab.bautista@loopwise.test` (MEDTECH), `pharm.garcia@loopwise.test` (PHARMACIST), `cashier.dela.cruz@loopwise.test`
  (CASHIER), `front.desk@loopwise.test` (RECEPTIONIST). Reference data: a PSGC sample (Region VII, Bohol, Tagbilaran and
  its barangays), the curated ICD-10 list, a few RVS codes — codes marked to be checked against the PSA / PhilHealth
  publications.
- **Merging into main:** the `loopwise` database must be dropped, recreated, migrated and reseeded; its chats and the
  clinic's LLM config row do not survive. Re-enter the LLM key in Settings → Clinic → Agent as `test@test.test`.

Flaky tests: real-LLM Playwright specs can flake on model wording; `a11y` (aria-prohibited-attr on the context-window
ring) and the results-inbox ordering are known flakes; `patient-chart` › "Wise resizes from the keyboard" failed once
(the first ArrowLeft lands before the splitter is ready) and passed 3/3 on rerun. `test/user-management.e2e-spec.ts`
expects `BETTER_AUTH_URL=http://localhost:3000` (a worktree on another port must set it for that spec). A worktree
running its own frontend next to main's also needs `TANSTACK_DEVTOOLS_PORT` (main uses 42069). The
`flows` › "a chat from the list opens" test skips on a database without chats (a fresh seed has none).

Known UI issue: the avatar's white initials fail contrast on some palette colours, picked from the user's name
("Test Admin" hit it; the seed keeps the admin's name "Test").

## Next: Phase 1 — front desk and AI scribe

- **Clinic setup** (the `clinics` domain): clinic profile (BIR, DOH, PhilHealth, address with PSGC), rooms, services and
  prices (`service_items`, `clinic_service_prices`), practitioner clinics, schedules and leaves; move
  `apps/api/src/clinics` and `apps/api/src/organizations` under `clinical/clinics/`.
- **Appointments and queue** (`scheduling`): booking / reschedule / cancel / no-show, walk-in queue with the priority
  lane (RA 9994, RA 10754), status board, triage at the nurse station; appointment → encounter on check-in
  (`encounters.appointment_id`); reminder jobs.
- **AI scribe:** dictation or recording → one structured card set (SOAP, vitals, diagnoses, Rx, orders, med cert,
  follow-up date, patient summary), each confirmed separately; recording consent per visit (`patient_consents` with
  `encounter_id`).

## Later

- **Pharmacy and inventory** (`inventory`): items (FDA CPR, dangerous drugs), lots (FEFO), receipts, the dispense queue
  writing `stock_movements` and `prescription_items.dispensed_qty` (the issued-Rx lock already allows those columns).
- **Billing:** cashier shifts (X/Z reading), professional fees with EWT, corporate accounts and consolidated invoices,
  HMO LOAs and transmittals, PhilHealth claims (`philhealth_claims`, Konsulta enrollment), a printed invoice.
- **Follow-ups:** a list from `encounters.follow_up_date` / `disposition`, reminders that book appointments; referral
  responses (accept / decline / complete) and a referral letter print (the API creates and cancels referrals only).
- **Patient master UI:** contacts, problems, history, documents (schema ready; registration captures address and IDs).
- **Immunizations** (`immunizations`), **procedures** (`encounter_procedures` with RVS).
- **Reference data:** load the full PSGC, ICD-10 (WHO) and PhilHealth RVS / case rates; ICD-10 search from
  `icd10_codes` (it still searches the curated shared list) and as a combobox.
- **Wise:** per-role tool defaults; `chart_facility_panel`'s `facilityId` now means a clinic id; the seven older
  propose tools could move onto the generic card; `propose_skill` onto `ProposalCard` + `wiseOrigin`.
- **Access:** break-glass (`BREAK_GLASS` care relationships with a reason and expiry; no API yet).
- **Base-app modules that predate the API structure rules** (listed, not changed in Phase 0): charts, chats, agent,
  skills and attachments inject `ClinicRepository`; auth and setup inject `OrganizationRepository`; user management
  reads clinic roles in its own repository; platform modules throw `HandlerError` rather than domain errors; the wise
  tool settings service drives its own transaction; `chat.repository.ts` is ~1000 lines.
- **Small:** the encounter page's own note form doesn't send `expectedVersion`; a PDF of a saved document; saving
  panel-level reports; deploy with Chromium in the API image (`CHROME_PATH`) for PDF export.

Verify with `npm run lint`, `npm test`, `npm run format:check` (see [CLAUDE.md](../CLAUDE.md)).
