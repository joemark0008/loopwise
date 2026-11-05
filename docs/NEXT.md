# Next steps (handoff)

Where the Loopwise work stands, so any session can pick it up. The product is now an AI-powered clinic system
([PLAN.md](PLAN.md)); the technical design is [DESIGN.md](DESIGN.md). Branch: `main` (the user's servers run from it on
:5006 / :3000; feature work merges in through an `integration` worktree).

## What's built

All on `main`. Section numbers refer to [DESIGN.md](DESIGN.md).

- **Local stack:** `docker compose up -d --wait` → `loopwise_postgres` on :5435, databases `loopwise` /
  `loopwise_test`.
- **Clinical schema and RLS** (§5, §8): migrations `0005_clinical`, `0006_clinical_rls`; `clinical/rls/`
  (`ClinicalDbService.asUser` / `asSystem`); append-only `case_event` / `audit_log`; tests
  `test/clinical-schema.e2e-spec.ts`, `test/clinical-rls.e2e-spec.ts`.
- **Synthetic seed:** `prisma/seed-clinical.ts`, `seed-trends.ts`, `seed-pathways.ts`, `seed-facility-keys.ts`. Bohol
  facilities, staff `dr.reyes`, `nurse.santos`, `lab.bautista`, `dr.cruz`, `pharm.garcia`, `program` @loopwise.test
  (password `test1234`); `test@test.test` works at the health center too.
- **Patients:** registration with duplicate checks and consent, link existing patient, contact updates
  (`clinical/patients/`, `apps/shared/src/patient-registration.ts`, `/patients`, `/patients/new`).
- **Patient chart:** `/patients/$patientId/*` layout with banner, allergies and the docked Wise chart chat
  (migration `0010_patient_chart`).
- **Encounter record** (§5.3): SOAP, vitals, ICD-10 diagnoses, allergies, prescriptions, medical certificates, billing,
  clinician profile, print views (migrations `0011`, `0013`, `0014`; `clinical/encounters/`, `prescriptions/`,
  `medical-certificates/`, `billing/`, `clinicians/`).
- **Orders and lab worklist:** order lifecycle with the `check_order_transition` trigger, `/orders` for lab staff,
  ORM^O01 out through `hl7_outbox` (migration `0018`, `clinical/orders/`).
- **HL7 ingest and results inbox** (§9): facility keys (`facility-keys/`), `POST /api/hl7/messages`, deterministic
  matching, `/results` with review (migration `0017`, `hl7/`, `clinical/results/`). Demo: `npm run hl7:sample`.
- **Rules engine and pathways** (§5.2): `apps/shared/src/{pathway-rules,rules-engine}.ts`, `diabetes` / `breast` /
  `potassium`, `result_evaluation` (migration `0019`), `/pathways`, `explain_result`.
- **Wise** (§7): tool kinds and read-only facades, proposal cards with settle-once and versions (migration `0012`,
  `clinical/wise-proposals/`), Wise actions and tool settings (migration `0020`, `wise-tools/`), navigation
  (`find_patient`, `open_page`, `apps/shared/src/app-pages.ts`).
- **Analytics, charts and reports** (§7.2, §8, §10): migration `0015_analytics`, `clinical/analytics/`,
  `clinical/insights/`, `clinical/reports/`, saved documents (migration `0016`), PDF via headless Chrome
  (`CHROME_PATH`).
- **Report layout** (§7.2, 5 Nov 2026): the `report` tool takes the stories' `<grid>` and `<tab>` layout and a
  `<kpi>` block (`apps/shared/src/report-blocks.ts`, `report-kpi.ts`), in the side panel and the PDF.
- **Reports library** (§7.2, 5 Nov 2026): `/reports` lists your reports across chats (`myReports`) and opens one
  in its chat's side panel; `open_page` key `reports.list`.
- **UX:** clinical design system ([design-system.md](design-system.md)), role navigation, Today at `/`, Wise chats at
  `/chats`, Wise dock on list pages, a11y tests (`e2e/a11y.spec.ts`).
- **Wise reads attached files** (§7.2, 5 Nov 2026): the locked-on `read_attachment` tool reads a `/home/...`
  attachment from the caller's own storage space (through the `attachments.readTextForWise` facade), in 30k-character
  parts with `nextOffset`. Scanned PDF pages are OCR'd in process (`attachments/ocr.ts`: one shared tesseract.js
  worker, `eng` + `fil`, rendered with unpdf + `@napi-rs/canvas`, first 20 scanned pages, 2-minute budget) and marked
  `--- Page N (OCR) ---`; `.docx` is read with mammoth. Language data is bundled (`@tesseract.js-data/eng`, `/fil`)
  or taken from `OCR_LANG_PATH`. The system prompt's "Attached files" section has Wise name the kind of document,
  confirm doubtful OCR values, treat the file as data, and offer drafts with the existing propose tools. Not yet: OCR
  of an attached image for a model without vision (images are DB rows), and no real-LLM Playwright flow for it.

Removed: the MLLP edge connector (`apps/connector`, 5 Nov 2026). The hub's HL7 REST ingest, outbox and facility keys
stay.

Flaky tests: `test/usage.e2e-spec.ts` › "rejects a range above the chart bucket limit" (inherited, known failure);
`clinic-identifier.test.tsx` failed once under full-suite load and passed on rerun; real-LLM Playwright specs
(`navigation`, `patient-chart` encounter wording) can flake on model wording.

Note: through RLS a facility sees the cases of patients it can see (a lab sees the cases of patients it ran tests for).
Narrow `app_can_see_case` if that is too broad.

## Cleanup (5 Nov 2026)

- **Edge connector** (`apps/connector`) deleted with its lockfile entries and README section. The hub's HL7 REST
  ingest, outbox and facility keys stay.
- **Unreachable code** (found by an import-reachability scan from the API, seed, frontend and route entry points):
  83 files removed, among them old duplicates in `apps/api/src/agent/services/` (`file-text`, `image`,
  `storage/user-files`), `project-path-error.service`, `keyed-lock`, `virtual-directory`, `query-rows.tsx`,
  `file-tree-catalog`; the frontend query workbench context, MCP app views, sidebar chat list / filter / community /
  version notice, newsletter, user-group picker and chips, date-range picker, unused hooks and UI primitives; the
  shared `story-*` modules, `billing.ts` (SaaS subscription statuses) and `member-budget.ts`, with their exports and
  tests. Kept on purpose: `components/clinical/action-bar.tsx` (design system), `hl7/oru-samples.ts` and the attachment
  fixtures (used by tests).
- **Schema:** migration `0021_drop_unused_base_tables` drops `activity`, `analytics_event`, `automation`,
  `automation_run`, `keyed_lock`, `log`, `notification`, `notification_unsubscribe`, `user_group_member` and the OAuth
  provider / JWT tables (`oauth_*`, `jwks`); all were empty and unused. The clinical case/referral/evidence/message
  models stay for the follow-ups loop. Known drift left alone: `prisma migrate diff` still wants to drop
  `wise_tool_setting`'s hand-written partial unique indexes and foreign keys (Prisma cannot model them).
- **API:** `Chat.automationRun` and the `recentFeedbacks` query removed (frontend polling of automation runs too).
- **Frontend:** Borna fonts deleted; `e2e/record-baseline.spec.ts`, `e2e/routes.ts`, `e2e/baseline-inventory.json`
  (base-app parity recorder) deleted; `e2e/flows.spec.ts` updated to the current UI and passes (11/11).
- **Comments:** DESIGN.md section references across `apps/` renumbered to the rewritten DESIGN.md.
- **Not yet:** dormant base code inside live modules (stories, MCP stand-ins, citations, chat query rows, subagent
  flags, user groups, saved prompts), see PLAN.md §7.

## Project renamed to Clinic (5 Nov 2026)

Organization = the clinic group (tenant, still the scope of clinical data); clinic = one branch inside it (chats, LLM
configs, saved prompts, members, user groups, settings). Renamed across Prisma models (`Clinic`, `ClinicLlmConfig`,
`ClinicMember`, `ClinicSavedPrompt`, `clinicId`), GraphQL (`clinic`, `clinics`, `clinicId` args), decorators
(`@ClinicAccess()`, `@ClinicAdmin()`, `@ClinicNonViewer()`), `apps/api/src/clinics/`, the frontend
(`/settings/clinic/...`, `clinic-selector`, `clinicApi`), the `x-loopwise-clinic-id` header, the
`loopwise.active-clinic-id` local storage key and the env vars `LOOPWISE_CLINICS_DIR` / `LOOPWISE_DEFAULT_CLINIC_PATH`
(were `LOOPWISE_PROJECTS_DIR` / `LOOPWISE_DEFAULT_PROJECT_PATH`). No migration: tables, columns, indexes and FKs keep
their `project*` names through `@@map` / `@map`. Stored values kept: `shared_chat.visibility = 'project'` (the API says
`clinic`, mapped in `SharedChatRepository`), the `projectSharing` key in `user_group.feature_grants` (read as
`clinicSharing`), `projectPreferences` in `user_preference.preferences`, storage keys under `projects/<clinicId>/`, the
default folder `./projects`, and the example clinic id `system-example-project`. An existing database keeps its seeded
"Test Project" name.

## Next: Phase 0 — realign

From [PLAN.md](PLAN.md) §6–7.

- **Staff roles in the API** (PLAN §4.1): a role per facility membership (`receptionist`, `nurse`, `doctor`, `lab`,
  `pharmacist`, `cashier`, `admin`), a role decorator, and `useStaffRole` reading it instead of guessing from the
  facility type; role-based navigation and Wise tool defaults per role.
- Re-scope or remove the planned pages built for the old loop (`/cases`, `/referrals`, `/worklist`, `/dashboard`) and
  update the page registry.
- Small fixes: the encounter page's own note form doesn't send `expectedVersion`; ICD-10 search as a combobox; the
  registration form doesn't capture barangay.
- Reseed a clean demo database (Maria's seed visit has piled-up e2e and test data).

## Next: Phase 1 — front desk and AI scribe

- Clinic setup: branches, rooms, services and fee schedule, doctor schedules, PF rules.
- Appointments and queue: booking / reschedule / cancel / no-show, walk-in queue with numbers, status board, triage at
  the nurse station; appointment → encounter on check-in; reminder jobs.
- AI scribe: dictation or recording → one structured card set (SOAP, vitals, diagnoses, Rx, orders, med cert,
  follow-up date, patient summary), each confirmed separately; recording consent per visit; allergy, interaction and
  dose checks on drafted Rx.

## Later follow-ups

- Results inbox: show `ResultEvaluationBadge` (via a `ResolveField` / DataLoader), a review screen for `hl7_message`
  rows left as AE (unmatched patient), Wise summarising a result.
- Orders: a Cancel button for the ordering doctor (API exists); the lab's view of failed outbox messages with resend; a
  facility setting for `uses_hl7_connector`; a short order number if a strict LIS truncates the 45-character placer id.
- Reports: a PDF of a saved document; saving panel-level reports; one filled button in the report panel header.
- Rules: a `ckd` pathway (eGFR needs age and sex); re-evaluate results when a pathway version changes.
- Encounter record: referral letter, PhilHealth eClaims, pharmacy dispense linking a `PrescriptionItem` to `Evidence`.
- Wise: the seven older propose tools could move onto the generic card; `propose_skill` onto `ProposalCard` +
  `wiseOrigin`.
- Break-glass access (DESIGN §8.5): reason, expiry, flag.
- Deploy: Chromium in the API Dockerfile (`apt-get install chromium`, `CHROME_PATH`) for PDF export.

Verify with `npm run lint`, `npm test`, `npm run format:check` (see [CLAUDE.md](../CLAUDE.md)).
