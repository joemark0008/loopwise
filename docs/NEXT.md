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
- **Clinic setup (Phase 1, branch of session 1):** `apps/api/src/clinical/clinics/` now holds `clinics/` and
  `organizations/` (moved from `src/`; other modules use `ClinicDirectoryService` / `OrganizationsService`, an ESLint
  rule keeps the domain's repositories inside it), `profile/`, `expiries/` and `document-sequences/` settings
  (`ClinicSetupModule`); `practitioners/setup/` and `practitioners/schedules/`; `billing/service-items/` catalog. Admin
  pages under Settings → Clinic: **Clinic profile** (organization TIN / VAT / SEC-DTI / logo for its ADMIN or a
  SUPER_ADMIN; clinic code, BIR branch code, DOH LTO, PhilHealth accreditation, PSGC city search + barangay),
  **Practitioners** (profile incl. TIN and e-signature, sign-in user, room and consult fee, weekly hours with no
  overlap at any clinic, leaves in Philippine dates), **Services and prices** (catalog with test / inventory link,
  clinic price and HMO rate), **Staff and roles** (desk-role matrix on the user management API), **Numbering**
  (prefix with the year + digits; the format carries into the next year), **Expiring licenses** (PRC, S2, PhilHealth
  PAN, DOH LTO, PhilHealth accreditation within 30/60/90 days). For booking: `PractitionerScheduleService`
  (`availabilityFor(tx, practitionerId, clinicId, date)`, `isOnLeave(tx, practitionerId, from, to?)`,
  `upcomingLeaves`, `weeklySchedule`) and GraphQL `practitionerAvailability`. Every change audited
  (`clinic.update`, `organization.update`, `practitioner.*`, `practitioner_schedule.*`, `practitioner_leave.*`,
  `service_item.*`, `clinic_service_price.*`, `document_sequence.update`). No migration. Seed: clinic registrations,
  weekly hours for the three doctors, consult fees, Dr. Cruz's leave next week, credential expiries inside the 60-day
  window, two clinic price overrides; it runs before the scheduling seed, which then keeps these hours. `npm run db:seed:clinic-setup -w @loopwise/api` adds it to an already-seeded database (fills empty values only, idempotent, resets nothing). Tests: `test/clinic-setup.e2e-spec.ts`, `test/practitioner-availability.e2e-spec.ts`,
  `availability.spec.ts`, `credential-expiry.spec.ts`, `e2e/clinic-setup.spec.ts` (incl. axe).
- **Encounters (§5.1):** visit number, type, status transitions, SOAP note, vitals, ICD-10 diagnoses, the chart and
  the encounter page with tabs, print views; prescriptions (RA 6675, RA 9165) and medical certificates (draft, issue,
  void), referrals (written from a visit; answered and printed, see Follow-ups and referrals).
- **In-house lab:** catalog, orders, the lab worklist (`/orders`: collect, enter results, release), results inbox
  (`/results`) and the chart's Results tab (`clinical/diagnostics/`).
- **Cashier (Phase 2, DESIGN.md §5.6):** `clinical/billing/` on `invoices` / `invoice_lines`: "Load charges" from the
  visit (consult fee, tests ordered, medicines dispensed, from Pharmacy's `InventoryBillingService`, billed once by stock movement), the BIR tax split in
  `InvoiceTotalsService` (Decimal; VAT only for a VAT-registered organization), SC/PWD from the patient's OSCA / PWD ID
  on file on the eligible lines, other discounts with an approver, creditable withholding; BIR invoice series managed
  by admins (ATP / CAS, range, validity; exhausted / expired refused); split-tender payments on the cashier's open shift
  (X / Z readings with denominations and variance); payment and invoice voids by admins; professional fees with EWT
  created on issue, a PF report and release; the printed BIR sales invoice (`/print/invoice/:id`). Pages: `/cashier`
  (desk, shifts, professional fees, invoice series), the encounter's Billing tab, a "Bill" link on the queue's cashier
  line. Wise: `list_billing` (collections, open invoices, shift; read only). Migration `0003_billing`.
  `npm run db:seed:billing -w @loopwise/api` adds the desk demo (OSCA IDs for Jose and Pedro, fee terms, the cashier's
  open shift, Pedro's visit at the cashier) to a seeded database without a reset. Tests: `test/cashier.e2e-spec.ts`,
  `test/billing.e2e-spec.ts`, `invoice-totals.service.spec.ts`, `invoice-totals.parity.spec.ts`,
  `e2e/cashier.spec.ts`. Left: refunds (REFUNDED); a settings UI for each doctor's EWT rate and clinic share (columns on `practitioner_clinics`,
  seeded); corporate / HMO consolidated invoices; buyer TIN and address on the invoice form; a printed X / Z reading.
- **Appointments and queue (§5.4, Phase 1):** `clinical/scheduling/`: slots from the doctor's schedule minus leaves
  and bookings within `max_patients`; book / reschedule (`rescheduled_from`) / cancel with a reason / confirm /
  no-show; check-in (booking or walk-in) opens the visit (`EncounterService.openForCheckIn`) and issues the queue
  number in one transaction; lanes "A" and "P" (priority: SC, PWD, pregnant, with infant, emergency), called first;
  triage → the doctor's line → the cashier, kept in step with the visit and the booking; the waiting-room board;
  next-day reminders (pg-boss job, stub notifier). Pages: `/appointments` (day / week, per doctor), `/queue`,
  `/triage`, `/my-queue`, `/board` (full screen, no names). Wise: `list_appointments`, `list_queue`,
  `propose_appointment`, `propose_reschedule`, `list_follow_ups`, `list_referrals`. Seed: clinic hours for Dr. Reyes (daily), Dr. Cruz (MWF) and the admin
  doctor (06:00–23:30, for same-day e2e bookings), bookings today and tomorrow, today's queue (A-001 Ramon and A-002
  Liza at triage, P-001 Jose with Dr. Reyes). `npm run db:seed:scheduling -w @loopwise/api` adds it to a database
  seeded before (no reset).
- **Follow-ups and referrals (§6, Phase 2, visit flow session):** the queue ticket and the booking now follow a visit
  moved from the encounter page (Start consult, Send to billing, Complete, Cancel) as well as from the queue pages:
  `EncounterService.transition` publishes `EncounterStatusChanged` on its own transaction
  (`encounters/encounter-status-events.ts`) and scheduling's `VisitStatusSync` moves the ticket (`followVisit` in
  `queue-status.ts`) and the booking, audited `queue.follow_visit_<status>`; queue-page moves pass `trigger: 'queue'`
  (DESIGN.md §5.4). `clinical/follow-ups/`: `followUps(input)` lists visits whose `follow_up_date` is overdue, due or
  within N days until a later visit or standing booking with the same doctor, computed live (no pg-boss job): a doctor's
  own, the front desk's clinic list by doctor, a clinic admin's (system read after the admin check). Referral answers
  `acceptReferral` / `declineReferral` (reason) / `completeReferral` (response notes), `referrals(input: { box: INBOX |
OUTBOX | CLINIC })` and `referralLetter(id)` (`clinical/documents/referrals/`). Wise: `list_follow_ups`,
  `list_referrals` (read, audited, `FOLLOW_UPS_READER`); booking a due follow-up is `propose_appointment` in the chart
  chat. Pages: `/follow-ups` (Book follow-up opens Scheduling's booking dialog pre-filled: patient, doctor, suggested
  day, FOLLOW_UP), `/referrals` (inbox, sent, whole clinic for admins; response dialog), `/print/referral/:id`; the
  doctor's line opens a waiting patient's visit; the encounter page's **Referrals** tab lists the visit's referrals
  (letter, cancel) and writes new ones (Refer). No migration (the RLS policies on `encounters`, `appointments` and
  `referrals` cover it). Seed: Teresita Cabahug (overdue, Dr. Reyes, external referral SENT), Roberto Lim (in 3 days,
  internal referral to Dr. Cruz SENT), Carmen with Dr. Cruz (due today); `npm run db:seed:follow-ups -w @loopwise/api`
  adds them to a seeded database (once, resets nothing). Tests: `test/follow-ups.e2e-spec.ts`,
  `test/referral-responses.e2e-spec.ts`, the "ticket follows the visit" block of `test/scheduling.e2e-spec.ts`,
  `follow-up-window.spec.ts`, `queue-status.spec.ts` (`followVisit`), `e2e/follow-ups.spec.ts`.
- **Pharmacy and inventory (§5.5, Phase 2 session 1):** `clinical/inventory/` (`items/`, `suppliers/`, `receipts/`,
  `stock/`, `dispensing/`, `billing/`) and `/pharmacy` (overview with alerts, dispense queue and dispensing,
  items with lots and the stock ledger, receive stock, suppliers, supplies used). A new **pharmacy desk**
  (PHARMACIST, PHARMACY_ASSISTANT, INVENTORY_CLERK) opens on `/pharmacy`. Migration `0002_inventory` (the pharmacy's
  RLS path to issued prescriptions, their visit, patient and allergies; ledger checks). Numbering key
  `STOCK_RECEIPT` (`TAG-RR-…`). Billing hook for the cashier:
  `InventoryBillingService.dispensedChargesFor(tx: ClinicalTx, encounterId: string): Promise<DispensedCharge[]>`
  (exported by `InventoryModule`). `PrescriptionService.recordDispensed(tx, prescriptionId, lines)` moves
  `dispensed_qty` and the dispensing status. Wise: `find_stock`, `list_inventory_alerts` (read, audited). Seed: two
  suppliers, nine items linked to the price list, lots (AMX-2505 expiring in ~40 days, PCM-2504 expired, metformin
  low), the inventory clerk `stock.villanueva@loopwise.test`, Ramon's and Pedro's (tramadol, S2) prescriptions waiting.
  `npm run db:seed:inventory -w @loopwise/api` adds it to a seeded database (only what is missing). Tests:
  `test/inventory.e2e-spec.ts`, `stock-rules.spec.ts`, `dispense-rules.spec.ts`, `inventory-billing.service.spec.ts`,
  `e2e/pharmacy.spec.ts`.
- **AI scribe (§7.5, Phase 1):** the encounter page's **AI scribe** tab: recording consent per visit
  (`patient_consents`, PHOTO_VIDEO, with `encounter_id`; recording refused without it, typing always works), record /
  stop through `POST /api/scribe/transcribe` (audio not kept; like the chat's dictation, refused with
  `TRANSCRIPTION_DISABLED` while Settings → Clinic → Agent → Transcription is off), the transcript, the patient summary language, and
  **Draft with Wise** → one `propose_scribe_note` call → one card per part (SOAP, vitals, each diagnosis, Rx with
  allergies, tests from the catalog, certificate, follow-up, patient summary), each confirmed, edited or dismissed
  through its record's own mutation (`wiseOrigin.part`, settled per part; locked while Wise is still writing the reply
  that holds the draft, since the API saves it when the turn ends). The encounter note now carries the
  reference's review of systems, subjective and objective. `clinical/scribe/`, `agent/tools/propose-scribe-note.ts`,
  `@loopwise/shared/scribe`, `feature/scribe/`; synthetic demo consult in `@loopwise/shared/scribe-demo`.
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

Flaky tests: real-LLM Playwright specs can flake on model wording; the results-inbox ordering is a known flake;
`patient-chart` › "Wise resizes from the keyboard" failed once (the first ArrowLeft lands before the splitter is ready)
and passed 3/3 on rerun. `test/user-management.e2e-spec.ts` expects `BETTER_AUTH_URL=http://localhost:3000` (a worktree
on another port must set it for that spec). A worktree running its own frontend next to main's also needs
`TANSTACK_DEVTOOLS_PORT` (main uses 42069). The `flows` › "a chat from the list opens" test skips on a database without
chats (a fresh seed has none).

## Next: Phase 1 — front desk and AI scribe

- **Clinic setup:** built (see What's built). Left: a Wise read tool ("which doctors are in today") on
  `PractitionerScheduleService`; a logo / signature upload instead of a URL; HMO rates aren't used by invoices yet.
- **Appointments and queue** (`scheduling`): built (above); slots come from clinic setup's `PractitionerScheduleService`
  (`availability/practitioner-schedule-availability.ts`). The ticket and booking follow the visit both ways now
  (`VisitStatusSync`). Left: the 2-hour reminder,
  automatic no-show marking and a waitlist (PLAN.md §4.2); a real SMS notifier; a doctor sees only the bookings of
  patients already in their care (a new patient shows in their line at check-in).
- **AI scribe:** built (above, DESIGN.md §7.5). To check on a stack with an LLM key: the real-LLM Playwright test
  `e2e/scribe.spec.ts` › "drafts the whole visit as cards … (real LLM call)" (it creates a new visit for Maria Santos).
  The non-LLM "confirms and dismisses parts …" test writes a finished draft into the chart chat through `e2e/db.ts`
  (the stack's `DATABASE_URL`, from the repository `.env`).
  Notes for the other sessions:
    - The patient layout now reads the chart chat before its pages mount and wraps them in the chart chat's
      `AgentProvider` (`PatientAgentProvider`); pages under `/patients/:id` can use `useAgentContext()`.
    - `ENCOUNTER_TABS` has `scribe` (shown to staff who can add to the visit). `WiseOriginInput` has an optional
      `part`; `WiseProposalOutcome` has `edited`. `TranscribeModule` exports `TranscribeService` (and imports only the
      agent core); `DiagnosticsModule` exports `DiagnosticTestService` (`listActiveOn`).
    - `updateEncounterNote` takes `reviewOfSystems`, `subjective`, `objective`; left out, they are kept.
    - No migration: the scribe uses the reference's `patient_consents` and `encounters` columns as they are.

## Before real patients: privacy hardening (RA 10173)

Wise sends the patient data it reads (chart, results, scribe transcripts) to the clinic's LLM provider, an overseas
processor of sensitive personal information. Everything is synthetic today; before any real patient:

- **Minimise and mask:** send each tool only the fields its task needs, and replace direct identifiers (PhilHealth
  PIN, ID numbers, full address, mobile, email) with placeholders before the LLM call, restoring them in the
  confirmed card where needed.
- **Log what was sent:** for every LLM call that carried patient data, an audit row with the patient, the fields or
  tool outputs included, the provider and model, and the request id (not the content itself).
- **Clinic switch and DPA record:** a per-clinic "AI processing enabled" setting that stays off until an admin records
  the provider's data processing agreement (provider, date, zero-retention / no-training terms). Wise refuses patient
  tools while it is off.
- **Provider check:** only allow providers or endpoints configured as business APIs with no training and zero
  retention; warn on anything else (consumer keys, unknown base URLs).
- **Transparency and consent:** the privacy notice names AI processing and the overseas processor; keep the per-visit
  recording consent for the scribe; let a patient opt out of AI drafting for their record.
- **Paperwork (not code):** the clinic's DPO, a privacy impact assessment covering the AI processing, NPC registration
  where the thresholds apply, and a review by counsel familiar with the Data Privacy Act and NPC guidance.

## Last: SaaS — self sign-up and tenant billing

Planned for the final part, after the clinical features. Loopwise bills each tenant (organization); this is separate
from the cashier desk, which bills the clinic's patients.

- **Organizations vs clinics:** a different owner or business is a different organization (its own TIN, patients,
  prices, staff, invoices and stock, kept apart by row-level security); a branch of the same business is a clinic
  inside it. A doctor who joins an existing practice is added as staff; one person can belong to several
  organizations (an organization switcher). Today an organization can only be made by the first-run setup wizard
  (`disableSignUp: true`, no `createOrganization`), so ACEmc is a branch of the Tagbilaran organization.
- **Self sign-up with approval:** a public sign-up (name, email, password, terms and privacy notice), email
  verification, then a wizard for the business (name, trade name, TIN, VAT status), the first clinic (PSGC address,
  DOH license) and the owner's practitioner profile (PRC license). The owner becomes SUPER_ADMIN of the new
  organization, which stays **pending** until the platform operator approves it (clinical features locked while
  pending). Captcha or rate limits on sign-up; archive inactive organizations.
- **Pricing (to decide):** a base fee per clinic + a fee per active doctor seat (staff seats free) + an AI allowance per
  doctor with overage blocks; a 14–30 day free trial. Set the numbers after measuring real AI cost per visit from
  `llm_inferences`.
- **AI cost:** Loopwise-provided AI by default (one business API with a DPA and zero retention, billed through the
  allowance), the clinic's own key (BYOK, today's setup) as an option.
- **Payments:** a PH gateway (PayMongo or Xendit: cards, GCash, Maya, QR Ph, bank transfer); card auto-renewal, a
  monthly pay link for e-wallets; monthly or annual cycles, invoiced on the 1st (seats and clinics counted that day,
  last month's AI overage). Loopwise's own company issues BIR invoices to the clinics (VAT if registered; confirm
  with an accountant).
- **Dunning:** reminders at 0 / +7 / +14 days, **read-only** at +30 days (no new visits or invoices; records stay
  viewable and exportable), then suspension with data kept per the retention policy. Never block or delete patient
  records for non-payment.
- **To build:** platform-level tables outside tenant RLS (plans, subscriptions with trial / active / past_due /
  read_only / cancelled, usage per organization per month, subscription invoices and payments, gateway webhooks);
  a platform admin console (organizations, approvals, subscriptions, revenue, past due, credits); Settings →
  Subscription for the owner (plan, seats, AI used, invoices, payment method).
- **Rollout:** a demo version first (sign-up with approval, trial, pricing page, simulated billing, admin console),
  then the real gateway, BIR invoicing and dunning, then annual plans, promo codes and partner pricing.

## Later

- **AI scribe, next:** dose ranges by age and weight and interaction checks on the drafted Rx (only the allergy match
  is built); a setting to keep audio (it is never kept today); speech-to-text tuned for Taglish and Cebuano; a printed
  patient handout from the saved summary. The scribe on a visit opened at check-in (OPEN, booked doctor) works: the
  tab shows (`canEdit`), consent and `propose_scribe_note` accept the visit (`requireWritable`), and the doctor's line
  links to the waiting patient's visit (`e2e/follow-ups.spec.ts` checks the tab).

- **Pharmacy, next:** transfers between clinics (TRANSFER_OUT / TRANSFER_IN with `transfer_ref`), returns to the
  supplier and from patients (the billing hook already nets RETURN_FROM_PATIENT), a printed dangerous-drugs logbook and
  AMR report, Wise proposal cards for a receipt or an adjustment, a weighted-average unit cost (a lot keeps the latest
  cost), barcode scanning, and stock linked on the prescription form (`prescription_items.inventory_item_id` is set at
  the first dispense only).
- **Billing:** corporate accounts and consolidated invoices, HMO LOAs and transmittals, PhilHealth claims
  (`philhealth_claims`, Konsulta enrollment), refunds.
- **Follow-ups, next:** the list is built (above). Left: patient reminders for due follow-ups (needs the SMS gateway;
  the list is live, so a job would only send); a Wise card that drafts a referral (the encounter page's Referrals tab writes them; Wise
  has no `propose_referral` yet); a referral's answer
  doesn't notify the referring doctor beyond the Sent tab; a PDF of the letter (browser print only); clinic admins read
  the follow-up and clinic referral lists as system work because `app_can_see_patient` gives ADMIN no path of its own
  (a policy for admins would let them open those charts too).
- **Patient master UI:** contacts, problems, history, documents (schema ready; registration captures address and IDs).
- **Immunizations** (`immunizations`), **procedures** (`encounter_procedures` with RVS).
- **Reference data:** load the full PSGC, ICD-10 (WHO) and PhilHealth RVS / case rates; ICD-10 search from
  `icd10_codes` (it still searches the curated shared list) and as a combobox.
- **Wise:** per-role tool defaults; `chart_facility_panel`'s `facilityId` now means a clinic id; the seven older
  propose tools could move onto the generic card; `propose_skill` onto `ProposalCard` + `wiseOrigin`.
- **Access:** break-glass (`BREAK_GLASS` care relationships with a reason and expiry; no API yet).
- **Base-app modules that predate the API structure rules** (listed, not changed in Phase 0; the `ClinicRepository` /
  `OrganizationRepository` injections are fixed): user management
  reads clinic roles in its own repository; platform modules throw `HandlerError` rather than domain errors; the wise
  tool settings service drives its own transaction; `chat.repository.ts` is ~1000 lines.
- **Small:** the encounter page's own note form doesn't send `expectedVersion`; a PDF of a saved document; saving
  panel-level reports; deploy with Chromium in the API image (`CHROME_PATH`) for PDF export.

Verify with `npm run lint`, `npm test`, `npm run format:check` (see [CLAUDE.md](../CLAUDE.md)).
