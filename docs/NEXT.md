# Next steps (handoff)

Where the Loopwise work stands, so any session can pick it up. Branch: `main` (the user's servers run from it on :5006 / :3000; feature work merges in through the `integration` worktree).

## Done

- Base code stripped to what DESIGN.md §13 keeps (API, frontend, migration 0004).
- Clinical schema (§7): migration `0005_clinical`, append-only `case_event` / `audit_log`,
  `apps/api/test/clinical-schema.e2e-spec.ts`.
- Own Postgres: `docker compose up -d --wait` → `loopwise_postgres` on :5435, databases `loopwise` / `loopwise_test`.
- Docs renamed (README, CLAUDE.md, docs/DESIGN.md).
- Row-level security (§10.2): migration `0006_clinical_rls` (role `loopwise_app`, `SECURITY DEFINER` helpers
  `app_user_id()`, `app_org_ids()`, `app_can_see_patient()`, `app_can_see_case()`, policies on every clinical table),
  `apps/api/src/clinical/rls/clinical-db.service.ts` (`asUser` / `asSystem`) and
  `apps/api/test/clinical-rls.e2e-spec.ts`. The app connects as a superuser, which RLS never restricts, so `asUser`
  switches to `loopwise_app` for the transaction. Patient registration, HL7 ingest and jobs use `asSystem`.
- Synthetic seed (§14): `apps/api/prisma/seed-clinical.ts`, called from `seed.ts` (idempotent). Five Bohol facilities,
  staff `dr.reyes`, `nurse.santos`, `lab.bautista`, `dr.cruz`, `pharm.garcia`, `program` @loopwise.test (password
  `test1234`), seven synthetic patients, the `diabetes` and `breast` pathways, and cases at each kind of step:
  accepted referral, normal result closed, BI-RADS 4 referred, critical HbA1c escalated, order never collected, result
  awaiting review, lost to follow-up. `test@test.test` works at the health center too.

- Patient registration (§7, §9.2, branch `patient-registration`), the first clinical module and the pattern for the
  others: `apps/api/src/clinical/patients/` (module, resolver, service, repository, loader, `dto/`, `models/`).
  `myFacilities` (the user's organizations that own no clinic), `searchPatients` / `patient(id)` as the user (RLS,
  views audited), `checkPatientDuplicates`, `registerPatient` (system work: patient, identifiers at the facility,
  `encounter` care relationship, `patient.register` audit row; consent required) and `linkExistingPatient` (only a
  matched patient; `patient.link` audit row). Duplicates: MRN at the facility or PhilHealth anywhere blocks; name +
  birth date + sex warns. Field rules shared by API, form and card: `apps/shared/src/patient-registration.ts`.
  Frontend: `/patients`, `/patients/new`, `/patients/$patientId` (`feature/patients/`, `lib/patient-api.ts`, sidebar
  "Patients"). Wise: `propose_patient_registration` tool + the reusable `ProposalCard`
  (`feature/chat/components/tool-calls/proposal-card/`). Tests: `test/patients.e2e-spec.ts` (incl. a doctor at another
  facility can't see the patient), unit specs, `e2e/patients.spec.ts` (form + chat, one real LLM call).
- Patient chart (§9, branch `patient-chart`): migration `0010_patient_chart` (`chat.patient_id`, one chart chat per
  clinician per patient; `encounter.source_chat_id`). `apps/api/src/clinical/encounters/` (`encounters(patientId)`,
  `createEncounter`, as the user under RLS, `encounter.create` audit row; rules in `apps/shared/src/encounter.ts`).
  `/api/agent` accepts `patientId` for a new chat; Wise gets a "Current patient" block on every run
  (`PatientService.getChartSummary`) and no memories are extracted from chart chats. `propose_encounter` tool + card.
  Frontend: `/patients/$patientId` is the chart (summary, encounters, New encounter dialog, Ask Wise panel). Tests:
  `test/patient-chart.e2e-spec.ts` (scripted LLM), unit specs, `e2e/patient-chart.spec.ts` (one real LLM call).

- Wise navigation (§9.2, branch `nav-tools`): `find_patient` (search as the user, each match audited
  `Wise find_patient`) and `open_page` over the page registry `apps/shared/src/app-pages.ts` (chart access checked as
  the user, audited `Wise open_page`). Cards: `tool-calls/find-patient.tsx` (rows link to the chart) and
  `tool-calls/open-page.tsx` (auto-navigates once after a live reply when the user asked; never in embedded chats or
  on replay). The chart shows "Back to chat" when opened from a chat. Tests: `test/navigation-tools.e2e-spec.ts`
  (another facility can neither find nor open the patient), unit specs, `e2e/navigation.spec.ts` (one real LLM call).

- Encounter record (§7, branch `encounter-record`): migrations `0011_encounter_record` and
  `0013_encounter_bill_void_unique` (one non-voided bill per encounter) (SOAP columns on `encounter`;
  `vital_signs`, `encounter_diagnosis`, `patient_allergy`, `clinician_profile`, `prescription(_item)`,
  `medical_certificate`, `encounter_bill`/`encounter_charge`; RLS through the patient; lock triggers on issued
  documents and finalized bills). API: `encounterRecord(encounterId)` (one read, audited), `updateEncounterNote`, vitals,
  diagnoses (`searchIcd10`), allergies, `createEncounterOrder` (seed of `clinical/orders/`), prescriptions and
  medical certificates (save draft, issue with PRC license, void, print query), billing (`saveEncounterBill`,
  finalize, pay with OR number, void), `myClinicianProfile`. Wise: `propose_encounter` with vitals and diagnoses,
  `propose_encounter_note`, `propose_prescription`, `propose_medical_certificate`, `propose_charges` (drafts only). Shared rules in
  `apps/shared/src/{vitals,icd10,encounter-record,prescription,formulary,medical-certificate,lab-tests}.ts`. Frontend:
  `/patients/$patientId/encounters/$encounterId` (tabs), print views under `/print/…`, Settings → Account clinician
  profile. Seed: Maria Santos's first visit is a full record; Jose Ramos has a penicillin allergy and a draft
  amoxicillin Rx. Tests: `test/encounter-record-schema.e2e-spec.ts`, `test/encounter-record.e2e-spec.ts`,
  `e2e/encounter-record.spec.ts`, unit specs.

- Wise tool confirmation (§9.1, branch `tool-confirmation`): migrations `0012_wise_confirmation` (`audit_log.origin`,
  `encounter.version` + `bump_row_version` trigger, `wise_proposal_outcome`) and `0014_wise_record_versions`
  (`version` on prescriptions, certificates, bills). Tool kinds (`createTool({ kind })`, `getTools` fails closed),
  read-only service facades (`agent/services/tool-services.ts`), ESLint ban on services / repositories / Prisma in
  `agent/tools/`. `clinical/wise-proposals/` (`WiseOriginInput`, `WiseProposalService.verify` / `settle` /
  `verifyFollowUp`, `cancelWiseProposal`, `wiseProposalOutcomes`), wired into `registerPatient`,
  `linkExistingPatient`, `createEncounter`, `updateEncounterNote`, `savePrescription`, `saveMedicalCertificate`,
  `saveEncounterBill` (+ `expectedVersion` on the updates) and `recordVitals` / `addDiagnosis` (follow-ups of a
  confirmed `propose_encounter`). `ProposalCard` modes `create` / `update` / `destructive`, `diffFields`,
  `ProposalDiff`, Re-draft on a stale record. `propose_encounter_note` reads the note and its version (one tool: the
  encounter-record branch's version merged into it); every propose card sends `wiseOrigin`. Tests:
  `tools/registry.spec.ts`, `test/wise-confirmation.e2e-spec.ts`, `proposal-card.test.tsx`,
  `propose-encounter-note.test.tsx`, `propose-encounter-record.test.tsx`, `e2e/encounter-note-wise.spec.ts`.
- Wise analytics phase 1 (§9.2, §10.2, §12, branch `reports-charts`): migration `0015_analytics` (adds the nullable
  `patient.barangay`; schemas `analytics` and `app_private`; roles `loopwise_analyst` (LOGIN, synthetic dev password,
  `ANALYTICS_DATABASE_URL` to override) and `loopwise_analytics_owner`; `app_user_id()` now prefers the per-transaction
  bound identity; `pg_stat_activity` revoked from PUBLIC). `apps/api/src/clinical/analytics/` (repository with its own
  `pg` pool, `sql-validator.ts` on `libpg-query`, `metrics.ts`, service with audit and small-cell suppression). Tools
  `describe_analytics`, `run_analytics_sql`, `get_metric` (read facades); card `tool-calls/analytics-result.tsx`.
  Seed: barangays. Tests: `test/analytics-security.e2e-spec.ts`, `sql-validator.spec.ts`, `e2e/analytics.spec.ts`.
- Wise charts and summary reports (§9.2, branch `reports-charts`): `apps/api/src/clinical/insights/` (repository,
  service, `exportReportPdf` resolver, `report-pdf/` with the headless-Chrome printer). Tools
  `chart_patient_trend`, `chart_facility_panel`, `create_report` (patient, encounter, facility panel); shared schemas
  in `apps/shared/src/tools/{clinical-chart,chart-patient-trend,chart-facility-panel,create-report}.ts` and
  `apps/shared/src/icd10-chapters.ts`. The chart chat's patient record now lists problems, issued medicines, latest
  vitals and the last 5 results. Frontend: `tool-calls/clinical-chart.tsx`, `tool-calls/report-card.tsx`,
  `feature/reports/report-sections.tsx`, `lib/report-api.ts`. Seed `prisma/seed-trends.ts`: a year of check-ups for
  Maria (BP 128/82 → 140/90, HbA1c 6.1 → 7.2, FBS 112 → 131), earlier HbA1c for Pedro and Ramon. Audit actions
  `panel.view`, `report.generate`, `report.export`. The PDF needs Chrome or Chromium (`CHROME_PATH`; macOS Chrome is
  found by itself). Tests: `test/insights.e2e-spec.ts` (RLS, narrative guard, PDF owner-only), unit specs,
  `e2e/reports.spec.ts` (one real LLM call).

- UX redesign phase 1 (branch `ux-redesign`, [design-system.md](design-system.md)): clinical tokens (status tones
  checked by `theme/contrast.test.ts`), Poppins + Inter self-hosted, 40/44px controls, `components/clinical/`
  (`ClinicalFlag`, `StatusBadge`, `AllergyChips`, `PatientBanner`, `PageHeader`/`PageSection`, `EmptyState`,
  `ActionBar`). Role navigation (`lib/navigation.ts` `roleNavLinks`, `hooks/use-staff-role.ts`), phone bottom bar,
  linked breadcrumbs, skip link and route focus. Today at `/`, Wise chats at `/chats`, planned pages for results,
  cases, worklist, referrals, orders and dashboard (and the patient's results, cases and messages), all in the page
  registry. `/patients/:id/*` is one layout: sticky patient banner with allergies (`patientAllergies` query), Wise
  docked (overlay below 80rem, sheet on a phone). Agent, clinic and storage settings are admin-only. `e2e/a11y.spec.ts` (axe, WCAG 2.2
  AA) and `e2e/ux-screens.spec.ts` (screenshots, `E2E_UX_DIR`).

- UX redesign phase 2: patients list as a table; registration in fieldsets with required markers, linked errors and
  an error summary that takes focus; scrollable encounter tabs; orders and results as a table with result flags and
  reference ranges; vitals flagged against adult reference ranges (`vitalFlag`); one `StatusBadge`; a critical
  allergy warning on the Rx; visible OR-number label; actions right-aligned; print views with `@page`, colour
  printing and the patient's allergies on the prescription. The ICD-10 search is still a button list, not a combobox.

- UX redesign phase 3: Wise docks beside every list page too (top-bar Ask Wise, `feature/wise/wise-dock.tsx`; patient
  pages keep the patient's own chat); proposal cards marked as Wise drafts (coral rule, dashed badge) with clinical-tone
  warnings; a failed tool call reads "Failed"; the model picker is admin-only; find-patient rows show age and birth
  date. `e2e/navigation.spec.ts` › app shell covers the sidebar and the dock.

- Edge connector (§6.2, §11, branch `edge-connector`): new workspace `apps/connector` (`@loopwise/connector`), no
  runtime dependencies (Node 22 type stripping, built-in `node:sqlite`). MLLP listener (framing across partial and
  joined reads), commit ACK **after the message is in the local SQLite queue** (AR for non-HL7, AE if the write fails),
  forwarder to `POST /api/hl7/messages` (in order per sender; AA delivered, AE/AR or other 4xx failed and kept, 5xx /
  network retried with capped backoff, 401/403 halts with an alert), outbox poller (`GET /api/hl7/outbox` → LIS over
  MLLP → `POST /api/hl7/outbox/:id/ack`; off without `LIS_HOST`), `/health`, status log line, graceful shutdown, logs
  without bodies. `apps/connector/Dockerfile`, `docker-compose.example.yml`, `scripts/send-mllp.ts` (synthetic ORU),
  README. Tests against a fake hub and a fake LIS, plus end to end over TCP and HTTP (`npm test -w @loopwise/connector`).
- HL7 result ingest and the results inbox (§4.1 steps 5–6, §6.3, §11, branch `hl7-results`). Facility keys
  (`apps/api/src/facility-keys/`): `api_key` rows (sha256 + `lw_` prefix), `createFacilityKey` (key shown once),
  `revokeFacilityKey`, `facilityKeys` for org admins, and `@FacilityKey()` (= `@Public()` + guard, sets
  `@CurrentFacility()`, updates `lastUsedAt`); the seed adds the DEV-ONLY key `lw_dev_bohol_diagnostics_synthetic_key_0001`
  for `bohol-diagnostics`. `POST /api/hl7/messages` (`apps/api/src/hl7/`): Bearer facility key, `text/plain` body (one
  message, CR segments, no MLLP), 200 + ACK AA / AE / AR (AE and AR are final), 401 for a bad key, 5xx only when
  transient; idempotent per (org, MSH-10) through migration `0017_hl7_ingest` (`hl7_message`, no grant to
  `loopwise_app`). Pure parser, ORU^R01 mapper (NM/ST/TX/FT, OBX-8 to `ResultFlag`, PH time assumed) and ACK builder.
  Matching, never fuzzy: an identifier the sending facility issued, then PhilHealth anywhere, then the patient of the
  order (placer = `ClinicalOrder.id` sent to that facility); conflicts and a different birth date answer AE and stay in
  `hl7_message`. `apps/api/src/clinical/results/`: `ResultIngestService` (system work, `rawHl7`, order linked by placer
  or by the one open order for that test, `OrderService.markResulted`, audit `result.receive` with a null user and an
  `hl7` origin), `resultsToReview`, `reviewResult(input)` (audit `result.review` with the note; the order becomes
  `reviewed` once all its results are) and `patientResults`. `ClinicalEventsService` (`clinical/events/`) emits
  `result.received` with the result, patient and order ids after commit; the rules engine subscribes with `on()`.
  Frontend: `/results` (critical, abnormal, reports, normal; flags in words; Mark reviewed with a note; link to the
  chart) and the chart's Results tab (`feature/results/`, `lib/result-api.ts`). Demo: `npm run hl7:sample` or
  `scripts/send-hl7-sample.sh [order-id]` (`LOOPWISE_API_URL`; `HL7_VALUE=12.4 HL7_FLAG=HH` for a critical value).
  Tests: `src/hl7/*.spec.ts`, `test/facility-keys.e2e-spec.ts`, `test/hl7-ingest.e2e-spec.ts`,
  `test/results-inbox.e2e-spec.ts`, `e2e/results-inbox.spec.ts`.

- Lab side of orders (§4.1 steps 1–4, §7, §11, branch `lab-orders`): migration `0018_hl7_outbox` (additive: order
  status `rejected`; `clinical_order.accepted_at/collected_at/resulted_at/reviewed_at/closed_at/status_reason`; the
  `check_order_transition` trigger, which refuses any status change outside `orders/order-status.ts` for every writer;
  `organization.uses_hl7_connector`; the `hl7_outbox` table, which users can only INSERT, for the ordering facility's
  own orders). `OrderService`: `acceptOrder`, `rejectOrder(reason)`, `markOrderCollected` (target facility staff),
  `cancelOrder(reason)` (the ordering doctor), `labOrders(status)` / `labOrderCounts`, all as the user under RLS
  with audit rows `order.accept|reject|collect|cancel`. Exported for other modules, in the caller's transaction:
  `setResulted` (HL7 ingest; a late result reopens a reviewed order) and `setReviewed` (results
  review), `applyLabStatus` (inbound ORM/OML: ORC-1 SC + ORC-5 IP → accepted,
  CM → collected, UA/OC → rejected). Outbound HL7: `orders/hl7/orm-message.ts` (pure ORM^O01: PID-3 lists the target
  facility's identifier first, then MRN, PhilHealth and the hub id; ORC NW/CA with the order id as placer number;
  OBR with the LOINC code; escaping), queued in `hl7_outbox` when the target has `uses_hl7_connector`; ORC CA on
  cancel. REST for the edge connector behind `@FacilityKey()`: `GET /api/hl7/outbox?limit=20` →
  `[{ id, message }]` (the caller's pending ones; each fetch counts an attempt), `POST /api/hl7/outbox/:id/ack`
  `{ code: AA|AE|AR, ack }` → delivered or failed. Frontend: `/orders` is the lab worklist (`feature/orders/`, tabs
  Incoming / Accepted / Collected / Resulted with counts, STAT first, accept / reject with a reason / mark collected);
  `useStaffRole` returns `lab` when every facility of the user is a lab or imaging center (`Facility.type`), and their
  `/` redirects to `/orders`. The encounter's orders tab shows each status's time and the reject/cancel reason, and
  takes notes for the lab; the chart's visit lines show each test's status. Tests: `order-status.spec.ts`,
  `hl7/orm-message.spec.ts`, `test/lab-orders.e2e-spec.ts`, `feature/orders/order-format.test.ts`,
  `e2e/lab-orders.spec.ts`. The seed leaves `uses_hl7_connector` false (worklist demo); set it on
  `bohol-diagnostics` to feed the edge connector.

- Rules engine and pathways (§2, §6.2–6.3, §7, §8, branch `rules-pathways`): the pathway rules schema
  `apps/shared/src/pathway-rules.ts` (zod, schema version 2: numeric and coded triggers, contiguous bands with
  classification / urgency / reason / guideline / next state / SLA, unit conversions, `criticalFlag`, steps with SLAs,
  pathway SLAs, closure) and the pure engine `apps/shared/src/rules-engine.ts` (`RulesEngine.evaluate`: unit
  normalisation, lab critical flags ≥ urgent, unreadable values to a clinician's review, most serious pathway wins).
  Definitions in `apps/api/src/clinical/pathways/pathway-definitions.ts`, seeded by `prisma/seed-pathways.ts` on every
  `db:seed` (a newer `version` replaces the stored rules): `diabetes` v2, `breast` v2, `potassium` v1, with cited
  synthetic thresholds. Migration `0019_result_evaluation` (new append-only table; RLS through the result). API:
  `PathwaysService` (validated, cached load as system work), `RulesService` (`evaluateResult`, `evaluateAndStore`,
  `evaluationForUser`, `explainForWise`), `ResultEvaluationSubscriber` on `result.received`, which publishes
  `result.evaluated` (new event type in `clinical/events/`); GraphQL `pathways`, `resultEvaluation(resultId)` (as the
  user, audited `result_evaluation.view`). The seed backfills evaluations for seeded results. Frontend: `/pathways`
  (read-only bands, steps, SLAs, closure; sidebar for doctor, specialist and program), `ResultEvaluationBadge`
  (`components/clinical/`) for the results inbox, `lib/pathway-api.ts`. Wise: `explain_result` (kind `read`, card in
  `tool-calls/explain-result.tsx`); the chart record shows result ids. Tests: `pathway-rules.test.ts`,
  `clinical/pathways/rules-engine.spec.ts` (boundaries, conversions, BI-RADS, flags, no pathway),
  `pathways.service.spec.ts`, `test/rules-pathways.e2e-spec.ts` (HL7 → stored evaluation, RLS, append-only),
  `test/explain-result.e2e-spec.ts`, `result-evaluation-badge.test.tsx`.
- Wise actions and tool settings (§9.4, branch `wise-actions`): migration `0020_wise_tool_settings` (additive: the
  `wise_tool_setting` table). `@loopwise/shared/wise-tools` (catalogue, defaults per facility type) and
  `@loopwise/shared/wise-actions` (action definitions); `apps/api/src/wise-tools/` (`wiseToolSettings`,
  `setWiseToolEnabled` for facility admins, `setMyWiseToolEnabled`); the agent drops turned-off tools each run and the
  prompt lists them; `WiseProposalService.verify` refuses a turned-off tool at Confirm. Tools `propose_vitals`,
  `propose_allergy`, `propose_remove_allergy`, `list_results_to_review`, `propose_result_review`, `propose_order`
  (`agent/tools/action-tool.ts`, `list-results-to-review.ts`); `wiseOrigin` on `recordVitals` (direct card),
  `addAllergy`, `voidAllergy` (new `VoidAllergyInput`), `reviewResult` (critical needs a note from a Wise card), new
  `createEncounterOrders`. Frontend: Settings → Wise tools (`feature/settings/wise-tools-page.tsx`), the cards in
  `tool-calls/propose-action.tsx`, `ProposalCard` `confirmStrength='strong'`. Tests:
  `src/wise-tools/*.spec.ts`, `agent/tools/action-tool.spec.ts`, `registry.spec.ts`, `test/wise-tool-settings.e2e-spec.ts`,
  `test/wise-actions.e2e-spec.ts`, `propose-action.test.tsx`, `e2e/wise-actions.spec.ts` (four real-LLM flows).
  Phase 2 (same branch): `propose_diagnosis`, `propose_void_diagnosis`, `propose_void_vitals`, `propose_cancel_order`,
  `list_lab_orders` + `propose_lab_order_step` (lab staff, general chat), `propose_issue_document`,
  `propose_void_document`, `propose_bill_step`, `propose_save_report`, `propose_patient_update` (new `updatePatient`,
  contact details only, clinic/hospital staff). `wiseOrigin` on every void (`VoidEntryInput`), the order steps,
  `updateDiagnosis`, `markEncounterBillPaid`, and as an argument on `issuePrescription`, `issueMedicalCertificate`,
  `finalizeEncounterBill`, `acceptOrder`, `markOrderCollected`, `saveReportToChart`. Cards in
  `tool-calls/propose-record-actions.tsx`; tests `test/wise-actions-records.e2e-spec.ts`,
  `propose-record-actions.test.tsx`, two more real-LLM flows in `e2e/wise-actions.spec.ts` (diagnosis, lab accepts).

- Analytics phase 2 (same branch): `run_analytics_sql` / `get_metric` take a `chart` drawn from the result's own
  columns (server-checked); metrics have default charts; the card toggles Chart / Table. `chart_facility_panel` is no
  longer offered to the model. Playwright: "how many patients do I have, by age group, as a chart". The registration form doesn't
  capture barangay yet.
- Reports in a side panel (branch `reports-charts`): the `report` tool, `clinical/reports/` (versions from the chat,
  `exportWiseReportPdf`), `feature/reports/report-panel.tsx` (side panel / overlay, version menu, Print, PDF),
  `tool-calls/report-chip.tsx`, `@loopwise/shared/report-blocks`. Tests: `tools/report.spec.ts`,
  `report-blocks.test.ts`, the report case of `test/analytics-security.e2e-spec.ts`, `e2e/analytics.spec.ts`.
  Save to chart: migration `0016_clinical_document` (new append-only table), `saveReportToChart` /
  `patientDocuments` / `clinicalDocument`, `feature/reports/saved-documents.tsx` (Documents on the chart overview).
  Not yet: a PDF of a saved document, and saving panel-level reports (they have no patient). Playwright
  `e2e/reports.spec.ts` now covers the patient-chart report, PDF and save.
- All Recharts types for analytics (branch `reports-charts`): `@loopwise/shared/analytics-chart` (`chartProblem`,
  `compatibleChartTypes`, `buildAnalyticsChart`), pathway thresholds (`thresholdReferences`), the `screening_funnel`
  metric, the card's chart-type menu, seed BMI vitals for the panel (`seedPanelVitals`). Tests:
  `analytics-chart.test.tsx` (shared, per type), `analytics-result.test.tsx` (frontend, per type),
  `analytics-chart.spec.ts`, `e2e/analytics.spec.ts` (scatter and funnel, real LLM).
- Project renamed to **Clinic** (branch `worktree-agent-ae2e43b670342579e`): organization = the clinic group (tenant,
  still the scope of clinical data), clinic = one branch inside it (chats, LLM configs, saved prompts, members, user
  groups, settings). Renamed across Prisma models (`Clinic`, `ClinicLlmConfig`, `ClinicMember`, `ClinicSavedPrompt`,
  `clinicId`), GraphQL (`clinic`, `clinics`, `clinicId` args), decorators (`@ClinicAccess()`, `@ClinicAdmin()`,
  `@ClinicNonViewer()`), `apps/api/src/clinics/`, the frontend (`/settings/clinic/...`, `clinic-selector`,
  `clinicApi`), the `x-loopwise-clinic-id` header, the `loopwise.active-clinic-id` local storage key and the env vars
  `LOOPWISE_CLINICS_DIR` / `LOOPWISE_DEFAULT_CLINIC_PATH` (were `LOOPWISE_PROJECTS_DIR` / `..._DEFAULT_PROJECT_PATH`).
  No migration: tables, columns, indexes and FKs keep their `project*` names through `@@map` / `@map`. Stored values
  kept: `shared_chat.visibility = 'project'` (the API says `clinic`, mapped in `SharedChatRepository`), the
  `projectSharing` key in `user_group.feature_grants` (read as `clinicSharing`), `projectPreferences` in
  `user_preference.preferences`, storage keys under `projects/<clinicId>/`, the default folder `./projects`, and the
  example clinic id `system-example-project`. An existing database keeps its seeded "Test Project" name.

Flaky tests: `test/usage.e2e-spec.ts` › "rejects a range above the chart bucket limit" (inherited, now passes
most runs); `clinic-identifier.test.tsx` and the connector's "reports halted (503) on /health" failed once each under
full-suite load and passed on rerun; real-LLM Playwright specs (`navigation`, `patient-chart` encounter wording) can
flake on model wording.

Note: through RLS a facility sees the cases of patients it can see (a lab sees the cases of patients it ran tests for).
Narrow `app_can_see_case` if that is too broad.

## Pending (as of 3 Nov 2026)

Everything above is on `main`. Nothing below is started. Ordered by what the demo needs (DESIGN.md §14, §15).

### 1. Case engine (Days 7–9) — next big block

- Subscribe to `result.evaluated` (`RulesService`, TODO there): open or advance the `CareCase` toward `nextState`,
  set the owner, start the SLA timer from `slaHours` (pg-boss `@Job`). A `critical` evaluation alerts a clinician at
  once and never gets an automated patient message.
- Escalation of overdue steps (§4.2): result not reviewed in 48h, order not done in 7 days, patient not acknowledging.
- Referrals with accept / reject / re-route; `Evidence` and closing a case (evidence or a named sign-off);
  `lost_to_follow_up`.
- Patient messaging (`PatientMessage`) and the simulated patient phone (§5, §14 demo step 4).
- Screens: case timeline, nurse worklist, referral inbox; chart tabs for cases and messages; registry lines for
  `cases.detail` and `referrals.inbox`.
- Results inbox: show `ResultEvaluationBadge` (via a `ResolveField` / DataLoader, not one query per row), a review
  screen for `hl7_message` rows left as AE (unmatched patient), and Wise summarising a result (§4.1 step 6).

### 2. Wise actions, next (§9.4)

- Phase 2 is built (see Done). Cases, referrals, tasks and patient messages get their Wise actions as those modules
  land (their catalogue entries show "Coming soon").
- The results inbox's own review could require a note for critical results too (only Wise cards do now).
- The seven older propose tools could move onto the generic card.

### 3. Dashboard and remaining plan (Days 15–17)

- Program dashboard and loop-closure metrics with the equity view (§12); a `chart_program_metric` tool over its
  metrics. Check that the seed spreads sex, age band and barangay enough to show a gap.
- Radiology pathway in the demo (breast, BI-RADS) end to end.
- Deploy (MicroK8s / ArgoCD, §15 days 15–16); Chromium in the API Dockerfile (`apt-get install chromium`,
  `CHROME_PATH`) for PDF export; the connector's image is ready.
- Submission: technical docs, assumptions and limitations (§16 is a draft), the Loopwise demo video.

### 4. Smaller follow-ups

- Orders: a Cancel button for the ordering doctor (API exists); the lab's view of failed outbox messages (AE / AR)
  with resend; a facility setting for `uses_hl7_connector` (set by hand on `bohol-diagnostics` in the dev DB);
  ORC-2 / OBR-2 carry the 45-character order id, over v2.3.1's 22 — a short order number (column + ingest matching,
  migration) if a strict LIS truncates placer numbers.
- Edge connector: an admin view or CLI for failed messages (`MessageQueue.failed()` / `requeue`), pruning delivered
  rows, TLS on MLLP across untrusted networks.
- Reports: a PDF of a saved document; saving panel-level reports (no patient); the report panel header has two filled
  buttons (PDF, Save to chart) where the design system allows one.
- UI: ICD-10 search as a combobox instead of a button list; the Medicines card repeats the same drug across the latest
  prescriptions; no staff role in the API, so every non-lab user gets the doctor's navigation (and `/pathways`).
- Rules: a `ckd` pathway (eGFR needs age and sex); re-evaluate results when a pathway version changes.
- Encounter record: referral letter, PhilHealth eClaims, pharmacy dispense linking a `PrescriptionItem` to `Evidence`.
- `propose_skill` keeps its own card (move onto `ProposalCard` + `wiseOrigin` if wanted); the encounter page's own note
  form doesn't send `expectedVersion`, so two clinicians editing one note by hand can overwrite each other.
- The registration form doesn't capture barangay; one hand-registered dev patient has none.
- Break-glass access (§10.5): reason, expiry, flag; not built.
- A read-attachment agent tool (attached PDFs are only referenced by path).
- Cleanup: `e2e/flows.spec.ts` still tests removed base features (four failures); dormant base code (chat query
  rows, citations, query grouping in `lib/ai.ts`, MCP stand-ins, story and subagent flags, Borna fonts, sidebar
  chat-list components, community and version notices).
- Demo data: Maria's seed visit has piled-up e2e and test data (e.g. extra HbA1c results from connector tests);
  reseed a clean demo database before recording.

### 5. Outside the code

- Hack2skill registration closes **10 Nov 2026**; team confirmation.
- GitHub repository for Loopwise (no remote yet).
- Prototype, technical docs and assumptions due **20 Nov 2026**.

Verify with `npm run lint`, `npm test`, `npm run format:check` (see CLAUDE.md).
