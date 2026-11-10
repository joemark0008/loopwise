# Loopwise — Design

> **Run the whole clinic, with an assistant that drafts and a clinician who decides.**

Loopwise is an AI-powered system for Philippine outpatient clinics: front desk, nurse, doctor, lab, pharmacy, cashier
and the patient, with **Wise** (the AI assistant) drafting the work at every desk and a person confirming it. Every
visit is an encounter, and everything recorded during it hangs off that encounter.

This document is the technical design: architecture, the API structure, the data model, follow-ups, Wise, access
control and integration. The product, its users, the module list and the phases are in [PLAN.md](PLAN.md); what is built and what
comes next is in [NEXT.md](NEXT.md).

---

## 1. Product in one page

- **Customer:** private and multi-doctor outpatient clinics in the Philippines (1–10 doctors); later clinic chains,
  diagnostic centers and RHUs. Problem and users: [PLAN.md](PLAN.md) §1–2.
- **What we sell:** less typing, fewer dropped patients, cleaner records. Every desk gets a Wise draft it confirms in
  one click; every result reaches the doctor who ordered it.
- **Rules that never bend:** AI drafts, a person confirms (§7.1); deny-by-default access through care relationships
  and Postgres row-level security (§8); every view and every change is audited (§8.6); critical values always reach a
  clinician first and never get an automated patient message; synthetic data only outside a real deployment.
- **Regulatory frame:** Data Privacy Act (RA 10173) and NPC registration, PRC licenses on issued documents, PhilHealth
  (ICD-10, packages, eClaims later), BIR invoicing, senior citizen / PWD discounts.

## 2. A clinic day

The flow Loopwise supports end to end. Built parts are marked; the rest is planned in [PLAN.md](PLAN.md) §4 and §6.

1. **Booking.** A patient books by message, phone or the portal; the receptionist confirms Wise's booking card, or
   registers a walk-in (registration with duplicate check and consent: built). Bookings come from the doctor's open slots
   (`/appointments`: built, §5.4).
2. **Check-in and triage.** The patient gets a queue number; the nurse records vitals and the chief complaint, by hand
   or by dictation. Check-in opens the visit and gives the queue number (priority lane "P" first); the nurse calls the
   next patient at `/triage` and sends them to the doctor's line (`/my-queue`); the waiting-room board is `/board` (built,
   §5.4).
3. **Consult with the AI scribe.** The doctor dictates or records the visit (recording only with the patient's consent
   for that visit); Wise drafts the SOAP note, vitals, diagnoses (ICD-10), prescription, lab orders, medical
   certificate, follow-up and a patient summary in one pass, as separate cards on the visit, each confirmed by the
   doctor (built, §7.5).
4. **Lab (in-house).** The doctor orders tests from the clinic's catalog; the medtech collects the specimen, enters the
   results on the lab worklist (flags from the parameter's reference range) and releases them; the doctor reviews them
   in the results inbox, critical first (built). Send-out tests are flagged `is_outsourced` / `is_external`.
5. **Pharmacy.** The issued prescription lands in the dispense queue; the pharmacist dispenses from stock (FEFO lots),
   which writes the stock ledger and posts charges to the invoice (schema ready; module planned).
6. **Cashier.** The visit's invoice: lines, SC/PWD discount with the ID shown, VAT split, PhilHealth package, issue
   with the BIR invoice number, split-tender payment, void (built). HMO LOAs and cashier shifts: schema ready.
7. **Follow-up.** The doctor sets the encounter's follow-up date and disposition, or refers the patient (to a
   colleague or an outside doctor or facility). The front desk books the due follow-ups from the follow-up list; the
   receiving doctor accepts, declines or completes a referral, and the referring doctor prints its letter (built, §6).
   Reminders that message the patient: planned.

Exceptions that matter:

| Situation                                     | What happens                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Critical value (e.g. K⁺ 6.5, HbA1c 12%)       | Top of the results inbox for the ordering doctor; no automated patient message; reviewing it from a Wise card needs a note |
| A released result needs correcting            | The medtech re-enters it: the item goes back to in progress, the release and the review are cleared                        |
| An issued Rx, certificate or invoice is wrong | It is voided with a reason (a trigger refuses any other change); a new one is drafted                                      |
| Patient misses the follow-up date             | Shows as overdue on the follow-up list until booked or seen again by that doctor (reminders: planned)                      |

## 3. Patient communication principles

The patient never learns bad news from a machine.

| Severity        | Example                    | Channel                                                         |
| --------------- | -------------------------- | --------------------------------------------------------------- |
| Normal          | All within range           | Reassuring message; visit summary in the portal                 |
| Mild/borderline | Slightly high cholesterol  | Invite to a routine follow-up; explanation behind a secure link |
| Moderate        | Possible diabetes          | Human (phone/visit) first; the system only books and tracks it  |
| Serious         | Suspected cancer, critical | Always a clinician, never automated; the system ensures it      |

- SMS **invites**, never diagnoses: no numbers, no disease names.
- Plain Filipino / Cebuano / English, next step first.
- Templates approved by clinicians; the AI only works inside approved wording. Result explanations reach the portal
  only after a clinician approves them.
- Worried replies go to a human.

## 4. Architecture

### 4.1 Deployment model

- **One install, one business, many clinic locations.** Each deployment is a single instance run by one business,
  the **organization** (one row in `organizations`, created by the first-run setup wizard; there is no sign-up and no
  way to create another). It owns its patients (`patients.organization_id`, the MRN `patient_no` unique per organization) and its
  catalogs (tests, services, inventory items, HMO providers). Each branch is a **clinic** inside the organization: it
  has its BIR branch code, DOH license and PhilHealth accreditation, its document numbering, its visits, invoices and
  stock, and it is also the staff's Wise workspace (chats, LLM settings, saved prompts, user groups). Staff hold
  **roles per clinic** (`user_clinic_roles`: doctor, nurse, medtech, cashier, …) and optionally an organization role
  (`organization_members`: admin, member, viewer). A staff account's status is derived (`toManagedUser`): INVITED
  (created by an admin, no sign-in account yet: the set-password link not used), ACTIVE, or DEACTIVATED
  (`users.is_active` off, which takes precedence: a deactivated invitee shows as DEACTIVATED).
- **Everything in-house.** The lab is the clinic's own: tests come from the organization's catalog and results are
  entered on the lab worklist. A send-out test is flagged (`diagnostic_tests.is_outsourced`,
  `diagnostic_orders.is_external`); a walk-in with an outside doctor's request is a `LAB_ONLY` encounter with
  `external_physician`. There is no HL7 interface and no cross-organization ordering.
- **Self-hosted, single instance.** The business runs its own install (on premises or on its own cloud account) and
  keeps the data on its own infrastructure. There is no hosted multi-tenant service and no subscription billing.
- A single Docker image: the API also serves the built frontend (`docker-compose.prod.yml`).

### 4.2 Components

```
 Patient (SMS, portal: planned)
        │
 ┌──────▼─────────────────────────────────────────────────────┐
 │ Loopwise (NestJS modular monolith)                         │
 │                                                            │
 │  Clinic modules: patients, practitioners, encounters,      │
 │   diagnostics (lab), prescriptions, documents, billing     │
 │   scheduling (appointments, queue)                         │
 │   (+ pharmacy, inventory, PhilHealth,                      │
 │   HMO: schema ready, modules planned)                      │
 │  Wise agent (proposal cards)   GraphQL API (auth, roles)   │
 │  Postgres (RLS, audit)         pg-boss (reminders)         │
 └────────────────────────────────────────────────────────────┘
        │                      │                      │
   Staff web app          Wise chat / dock      Owner dashboard
```

### 4.3 Data flow (a visit)

1. The front desk registers the patient (organization MRN from the clinic's `PATIENT` sequence, data-privacy consent)
   and opens an **encounter** at the clinic (`encounter_no`, type, status `OPEN`).
2. The doctor (`practitioner_id`) takes the visit (`IN_PROGRESS`), records the SOAP note, vitals and ICD-10 diagnoses,
   orders tests (`diagnostic_orders` → one `diagnostic_order_items` row per test), drafts and issues the prescription
   and certificate. Wise drafts each of these as a card the doctor confirms (§7.1).
3. The medtech works the lab worklist: collects (accession no.), enters results (`diagnostic_results` +
   `diagnostic_result_values` with flags), releases them. The doctor reviews them in the results inbox.
4. The visit goes `FOR_BILLING`; the cashier drafts and issues the invoice and records the payment; the visit is
   `COMPLETED`, with a follow-up date and disposition.
5. Every step is one transaction that also writes its `audit_logs` row with the request's correlation id (§4.5).

### 4.4 Key decisions

| Decision                                              | Why                                                | Trade-off                                   |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| One instance per business, Postgres RLS per clinic    | Simple to run; data stays with the business        | Isolation depends on correct RLS; test hard |
| Modular monolith in NestJS, one module per domain     | Fast to build; modules talk through services       | One deployable                              |
| The PH clinic base schema, encounter-centric          | Patient and clinic of a record can never disagree  | RLS reaches child rows through a join       |
| In-house lab only, no HL7                             | The clinics we serve run their own lab or send out | An outside LIS needs an integration later   |
| Rules-first decisions; AI for language and assistance | Safe, explainable                                  | Less "AI magic"                             |
| Built on an existing agent base                       | Agent, chat UI, auth, orgs and jobs already worked | Leftover base code to keep pruning          |

### 4.5 API structure

**Module map.** One NestJS module per schema domain under `apps/api/src/clinical/` (the base schema's file names):

| Module                             | Covers                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinics`                          | `clinics/` (Wise workspaces, `ClinicDirectoryService`), `organizations/`, `document-sequences/` (numbering and its settings), `profile/` (legal details, BIR / DOH / PhilHealth, PSGC address), `expiries/` (licenses expiring soon); `ClinicSetupModule`                                                                                     |
| `reference`                        | ICD-10 search and validation, PSGC cities / municipalities and barangays                                                                                                                                                                                                                                                                      |
| `practitioners`                    | the practitioner profile (PRC, PTR, S2, PhilHealth PAN), the signatory printed on documents; `setup/` (admins: profiles, room and fee); `schedules/` (weekly hours and leaves; `PractitionerScheduleService` reads availability for booking)                                                                                                  |
| `patients`                         | registration (MRN, consent, duplicates), the chart, contact updates, allergies, identifications                                                                                                                                                                                                                                               |
| `encounters`                       | the visit and its status, the SOAP note, vitals, diagnoses, the encounter record                                                                                                                                                                                                                                                              |
| `diagnostics`                      | `catalog/`, `orders/`, `worklist/` (the lab desk), `results/` (the doctor's inbox)                                                                                                                                                                                                                                                            |
| `prescriptions`                    | prescriptions and items (RA 6675, RA 9165)                                                                                                                                                                                                                                                                                                    |
| `documents`                        | `medical-certificates/`, `referrals/` (written, answered: accept / decline / complete, inbox and outbox, the printed letter)                                                                                                                                                                                                                  |
| `follow-ups`                       | the follow-up list (visits whose `follow_up_date` is due, computed live), Wise's `list_follow_ups` / `list_referrals` reads (`FOLLOW_UPS_READER`)                                                                                                                                                                                             |
| `scribe`                           | the AI scribe: recording consent per visit, consent-checked transcription, the read behind `propose_scribe_note` (§7.5)                                                                                                                                                                                                                       |
| `billing`                          | `service-items/`, `invoices/` (`InvoiceTotalsService`, print), `charges/` (load charges, `DISPENSED_CHARGES` port), `discounts/`, `invoice-series/`, `payments/`, `cashier-shifts/`, `professional-fees/`, `cashier-desk/` (desk and `list_billing`); §5.6                                                                                    |
| `inventory`                        | `items/` (the inventory master, its link to the catalog service that sells it), `suppliers/`, `receipts/` (deliveries into lots), `stock/` (`StockLedgerService`, the one writer of the ledger; adjustments, write-offs, consumption, alerts), `dispensing/` (the dispense queue), `billing/` (`InventoryBillingService`, the cashier's hook) |
| `scheduling`                       | `appointments/` (slots, booking), `queue/` (check-in, lines, board, `VisitFlowService` / `VisitStatusSync`), `availability/` (adapts `PractitionerScheduleService`), `reminders/` (pg-boss job)                                                                                                                                               |
| `audit`                            | `AuditService`, the one writer of `audit_logs`                                                                                                                                                                                                                                                                                                |
| `wise-proposals`                   | settling Wise cards once (§7.1)                                                                                                                                                                                                                                                                                                               |
| `insights`, `reports`, `analytics` | Wise's charts, summary reports and SQL analytics                                                                                                                                                                                                                                                                                              |
| `rls`                              | `ClinicalDbService` (`asUser` / `asSystem`)                                                                                                                                                                                                                                                                                                   |

Domains of the schema without a feature yet (immunizations, PhilHealth, HMO) get their module
when the feature is built.

**Layering.** Resolver (or REST controller) → service → repository → Prisma. Resolvers parse arguments (class-validator
DTOs), check access with decorators (`@ClinicAccess({ staffRoles })`, `@ClinicAdmin()`, `@OrgAdmin()` …) and make one
service call. Services hold the rules and every status flow, each through one transition function with guards
(`encounter-status.ts`, `diagnostic-order-status.ts` mirroring the database trigger, `invoice-status.ts`). Repositories
are the only Prisma users and run inside `ClinicalDbService.asUser` (row-level security as the user) or `asSystem`.
Every multi-step write is one transaction, with its audit row. Modules use each other only through exported services
(or a reader token for Wise); there are no circular imports. Where a module must react to another's change without
importing it back, the changing module publishes a domain event on its transaction (`EncounterStatusEvents`: scheduling
listens, encounters never imports scheduling). Errors are domain errors (`DomainError` subclasses such as
`InvoiceAlreadyIssuedError`) with a stable `extensions.errorCode`; Postgres refusals map to stable codes too
(`ROW_SECURITY_DENIED`, `CHECK_VIOLATION`, `FOREIGN_KEY_VIOLATION`, `INVALID_ID`).

**Tracing a request.** Each request gets a correlation id (an inbound `x-request-id`, else a UUIDv7), kept in an
AsyncLocalStorage request context with the ip and user agent, echoed in the response header and in GraphQL error
`extensions.requestId`, prefixed to every Nest `Logger` line (`[req:<id> user:<id>]`) and stored in
`audit_logs.request_id`. Names match end to end, so a request can be followed with grep: GraphQL `issueInvoice` →
`InvoicesResolver.issueInvoice` → `InvoiceService.issue` → `InvoiceRepository` → `invoices`, and the audit row with
`event = 'invoice.issue'` and the same `request_id`.

## 5. Data model

The Prisma schema is an encounter-centric model for Philippine practice, split by domain in
`apps/api/prisma/schema/*.prisma`. Conventions: plural snake_case tables,
UPPERCASE enum values, UUIDv7 ids (`@default(uuid(7)) @db.Uuid`, better-auth generates UUIDv7 too), instants as
`timestamptz(3)`, calendar dates as `date`, clinic hours as `time`, money as `numeric(12,2)` in PHP. A clinic
branch is a **`Clinic`** (`clinics`, `clinic_id`, `UserClinicRole`, `PractitionerClinic`, `ClinicServicePrice`).
`*_by_id` columns that point at a user are plain uuids, as in the reference; the audit log is the trail.

Migrations: `0000_init` is generated by Prisma from the schema; `0001_rls_and_triggers` holds what Prisma cannot
express: roles and grants, the row-level security helpers and policies (§8), the triggers below, check constraints,
and the `analytics` schema with its views. `prisma migrate diff` between the migrated database and the schema is empty.

### 5.1 Encounter-centric

Every clinical record hangs off an **encounter** (the visit hub: clinic, patient, practitioner, appointment,
`encounter_no`, type, status). The children store only `encounter_id` (NOT NULL, with a foreign key), never the
patient or the clinic again, so the two can never disagree; queries go through the encounter
(`where: { encounter: { patientId } }`) and so does row-level security.

| `encounter_id` required                                                                                                                                     | optional (as in the reference)                                                                                                                                                                                                                    | not an encounter child (patient master data)                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| vital_signs, encounter_diagnoses, encounter_procedures, diagnostic_orders, prescriptions, medical_certificates, immunizations, referrals, philhealth_claims | queue_tickets (set at check-in), patient_consents (patient-level consents), patient_documents, hmo_loas, invoices (null only for a consolidated corporate/HMO bill; its lines carry the visit), invoice_lines, professional_fees, stock_movements | patient_addresses, patient_contacts, patient_identifications, patient_allergies, patient_problems, patient_histories, philhealth_memberships, patient_hmo_coverages |

Results reach their encounter through their order: `diagnostic_result_values` → `diagnostic_results` →
`diagnostic_order_items` → `diagnostic_orders` → `encounters`.

### 5.2 Domains

| File                     | Models                                                                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organization`           | Organization (TIN, VAT registration), Clinic (BIR branch code, DOH LTO, PhilHealth accreditation; + Wise workspace settings), User (+ better-auth), UserClinicRole, DocumentSequence; Loopwise: OrganizationMember, ClinicLlmConfig, ClinicSavedPrompt, UserGroup, UserPreference |
| `reference`              | Region, Province, CityMunicipality, Barangay (PSGC), Icd10Code (WHO), RvsCode, PhilHealthCaseRate                                                                                                                                                                                 |
| `practitioner`           | Practitioner (PRC, PTR, S2, PhilHealth PAN, TIN, e-signature), PractitionerClinic, PractitionerSchedule, PractitionerLeave                                                                                                                                                        |
| `patient`                | Patient (per organization, `patient_no`), PatientAddress, PatientContact, PatientIdentification (SC / PWD / PhilSys …), PatientAllergy, PatientProblem, PatientHistory, PatientConsent (RA 10173)                                                                                 |
| `scheduling`             | Appointment (1:1 with its encounter), QueueTicket (priority lane, RA 9994 / RA 10754)                                                                                                                                                                                             |
| `clinical`               | Encounter (SOAP), VitalSigns, EncounterDiagnosis (ICD-10, one primary), EncounterProcedure (RVS)                                                                                                                                                                                  |
| `diagnostics`            | DiagnosticTest, DiagnosticTestParameter (sex-specific ranges), DiagnosticOrder → Item → Result → ResultValue                                                                                                                                                                      |
| `prescription`           | Prescription (RA 6675 generic name, RA 9165 S2 / quantity in words), PrescriptionItem                                                                                                                                                                                             |
| `immunization`           | Immunization (NIP/EPI, lot, next due, historical entries)                                                                                                                                                                                                                         |
| `documents`              | MedicalCertificate (verification code), Referral (from a visit to a practitioner or an outside doctor/facility), PatientDocument                                                                                                                                                  |
| `philhealth`             | PhilHealthMembership, KonsultaEnrollment, PhilHealthClaim                                                                                                                                                                                                                         |
| `hmo`                    | HmoProvider, PatientHmoCoverage, HmoLoa, HmoTransmittal                                                                                                                                                                                                                           |
| `billing`                | ServiceItem, ClinicServicePrice, CorporateAccount, InvoiceSeries, Invoice, InvoiceLine, InvoiceDiscount, Payment, PaymentAllocation, CashierShift, ProfessionalFee                                                                                                                |
| `inventory`              | InventoryItem (FDA CPR), Supplier, InventoryLot (FEFO), StockMovement (signed ledger), StockReceipt, StockReceiptItem                                                                                                                                                             |
| `audit`                  | AuditLog (`action`, `entity_type`, `entity_id`, `changes`, ip, user agent)                                                                                                                                                                                                        |
| `loopwise`               | CareRelationship (the access rule), ClinicalDocument (saved Wise reports), WiseProposalOutcome, WiseToolSetting, DocumentStatus                                                                                                                                                   |
| `chats`, `auth`, `usage` | Wise chats and messages, better-auth accounts / sessions / verifications, LLM usage                                                                                                                                                                                               |

**Loopwise additions to reference models** (marked `Loopwise:` in the schema): on Encounter `notes`,
`patient_instructions`, `version`, `source_chat_id`; on VitalSigns, EncounterDiagnosis and PatientAllergy the void
columns (wrong entries are voided, never deleted; diagnoses also `recorded_by_id` / `recorded_at` and the
one-primary partial unique index); on Prescription and MedicalCertificate `document_status` (DRAFT → ISSUED),
`signatory` (prescriber and letterhead as printed), void columns, `version`, `created_at` / `updated_at`; on
DiagnosticOrderItem `status_reason` / `cancelled_at`; on DiagnosticResult `reviewed_at` / `reviewed_by_id` (the
doctor's review); on Invoice `version`; on AuditLog `event`, `reason`, `origin` (a confirmed Wise card) and
`request_id`; on Organization `slug` and Google sign-in settings; on Clinic the Wise workspace columns (`kind`, `path`,
agent / display / map settings, default models); on User the better-auth and base-app columns. StaffRole gains
`MEMBER`, `VIEWER` and `CONTEXT_ADMIN` (access roles).

**Numbering.** `DocumentSequenceService.next(tx, clinic, key)` issues per-clinic numbers that restart yearly (Asia/
Manila) and carry the clinic code: `TAG-PT-2026-000001` (patient no.), `TAG-ENC-…`, `TAG-LAB-…`, `TAG-RX-…`, `TAG-MC-…`,
`TAG-PAY-…`, `TAG-RR-…` (stock receiving). Invoice numbers come from the clinic's active BIR `InvoiceSeries` (ATP / CAS range), else the `INVOICE`
sequence.

### 5.3 Rules the database enforces

- **Append-only:** `audit_logs`, `clinical_documents`, `wise_proposal_outcomes` and the stock ledger `stock_movements`
  (a trigger rejects UPDATE and DELETE, for every role).
- **Row versions:** `encounters`, `prescriptions`, `medical_certificates` and `invoices` bump `version` on every update;
  a Wise card saves against the version it showed.
- **Issued documents are frozen:** once a prescription or certificate leaves DRAFT, only voiding moves (and, for a
  prescription, dispensing: its `status` and its items' `dispensed_qty`); an invoice after DRAFT only takes payments
  and voiding, and its lines and discounts are frozen (BIR). Drafts alone can be deleted.
- **Diagnostic order status machine** on the order and each item: REQUESTED → PAID | SPECIMEN_COLLECTED | IN_PROGRESS
  | RESULTED | CANCELLED; PAID → SPECIMEN_COLLECTED | IN_PROGRESS | RESULTED | CANCELLED; SPECIMEN_COLLECTED →
  IN_PROGRESS | RESULTED | CANCELLED; IN_PROGRESS → RESULTED | CANCELLED; RESULTED → RELEASED | IN_PROGRESS (a
  correction); RELEASED → IN_PROGRESS. The API mirrors it in
  `apps/api/src/clinical/diagnostics/orders/diagnostic-order-status.ts`; the order's status follows its items.
- **Checks:** one primary diagnosis per encounter (partial unique index); a referral names a target; a practitioner's
  day of week is 0–6; a queue number is positive; a pain score is 0–10; message parts carry the fields their type
  needs; a local Wise workspace has a path; a Wise tool setting belongs to an organization or a user, not both; a lot
  never goes below zero, a ledger row moves stock (quantity ≠ 0), a received quantity is positive and an Rx item's
  `dispensed_qty` stays between 0 and its quantity (`0002_inventory`).

### 5.4 Appointments and the queue

`apps/api/src/clinical/scheduling/` (`appointments/`, `queue/`, `availability/`, `reminders/`); UI in
`apps/frontend/src/feature/scheduling/`.

- **Slots.** A doctor's bookable slots on a day are their sessions at the clinic (`practitioner_schedules`, Manila
  time) cut into `slot_minutes`, minus leaves (`practitioner_leaves`) and active bookings, and once a session holds
  `max_patients` bookings (walk-ins included) its free slots are FULL. Bookings are counted as system work, so a desk
  that can't see every patient never double-books; a transaction-scoped advisory lock per doctor and day serializes
  booking. Schedules are read behind `PRACTITIONER_AVAILABILITY` (`availabilityFor`, `isOnLeave`), today from the
  tables (`ScheduleTableAvailability`); clinic setup's `PractitionerScheduleService` replaces it with one provider.
- **Appointment status** (`appointment-status.ts`): SCHEDULED → CONFIRMED → ARRIVED (check-in) → IN_PROGRESS → COMPLETED;
  SCHEDULED / CONFIRMED → CANCELLED (reason), NO_SHOW (after the booked time), RESCHEDULED (the new booking keeps
  `rescheduled_from`); ARRIVED → CANCELLED (left before the doctor), COMPLETED.
- **Check-in** (`CheckInService`) is one system transaction: today's booking goes ARRIVED (a walk-in gets a WALK_IN
  booking, already ARRIVED), `EncounterService.openForCheckIn` opens the visit (OPEN, `encounter_no`, the booked doctor,
  `appointment_id`, the type from the visit type) and gives the doctor's user a care relationship, and the queue ticket
  is issued.
- **Queue tickets** keep one number all day and move station to station: TRIAGE → DOCTOR (the ticket's
  `practitioner_id`) → CASHIER (`station` holds the code; the board shows "Triage", "Dra. Reyes · Room 1", "Cashier").
  Lanes: "A" regular, "P" priority (`priority_reason`: senior citizen RA 9994, PWD RA 7277 / RA 10754, pregnant, with an
  infant, emergency); numbers per clinic, Manila day and lane under an advisory lock (the unique index backs it up).
  Call order: the priority lane first, then by check-in time. Status (`queue-status.ts`): WAITING → CALLED → SERVING →
  DONE, SERVING → WAITING at the next station (transfer), CALLED → SKIPPED → WAITING (back in line), any open status →
  CANCELLED. A move only applies while the ticket's status is unchanged (QUEUE_TICKET_MOVED otherwise).
- **Kept in step** (`VisitFlowService`): starting a ticket at the doctor's room moves the visit OPEN → IN_PROGRESS and
  the booking → IN_PROGRESS; the doctor sending it to the cashier moves the visit → FOR_BILLING and the booking →
  COMPLETED; Done at the doctor (nothing to bill) → COMPLETED; cancelling a ticket before the doctor cancels the visit and
  the booking with the reason. The visit moves through `EncounterService.transition` first (with `trigger: 'queue'`);
  a visit already moved from the chart is left as it is.
- **The other way round** (`VisitStatusSync`): a visit moved anywhere else (the encounter page's Start consult, Send to
  billing, Complete visit, Cancel visit, Wise, billing completing a paid visit) moves its open ticket and its booking
  too. `EncounterService.transition` publishes `EncounterStatusChanged` (`encounters/encounter-status-events.ts`) on
  the transaction that moved the visit, after its audit row; scheduling subscribes on start-up, so encounters never
  imports scheduling (no circular module import) and the visit, ticket and booking commit or roll back together.
  `followVisit` (`queue-status.ts`) walks the ticket through its own status machine to where the visit's status puts
  it: IN_PROGRESS → SERVING at the doctor's room (from triage, or back from the cashier on a reopen), FOR_BILLING →
  WAITING at the cashier, COMPLETED → DONE, CANCELLED → CANCELLED; the booking goes IN_PROGRESS / COMPLETED /
  CANCELLED when its machine allows (a COMPLETED booking stays so on a reopen). Each change is audited
  (`queue.follow_visit_<status>`) with the user who moved the visit; a ticket another desk moved meanwhile is left as
  it is. Queue-page moves pass `trigger: 'queue'` and are skipped by the listener.
- **Desks** (`SchedulingAccess`): booking, check-in and cancelling: RECEPTIONIST; triage: NURSE / MIDWIFE; the doctor's
  room: that doctor; the cashier line: CASHIER / BILLING_CLERK; clinic admins every desk. Reads: any staff of the clinic,
  with row-level security on the patients (a doctor sees the bookings of patients in their care). The board reads numbers
  and stations only, as system work.
- **Reminders**: `scheduling.appointment-reminders` (pg-boss, 09:00 and 17:00 Manila) sends tomorrow's bookings through
  the `APPOINTMENT_NOTIFIER` stub (no SMS gateway yet; an invitation only, never clinical content) and sets
  `reminder_sent_at`, audited with the job as origin.

### 5.5 Pharmacy and inventory

`apps/api/src/clinical/inventory/` (`items/`, `suppliers/`, `receipts/`, `stock/`, `dispensing/`, `billing/`); UI in
`apps/frontend/src/feature/pharmacy/` under `/pharmacy`.

- **Item master** (organization): SKU, barcode, generic / brand name, strength, dosage form, manufacturer, FDA CPR
  no., Rx-only, dangerous drug (RA 9165), antimicrobial, PNF, storage, unit, pack size, tax type, cost, selling price,
  reorder level. A medicine or vaccine needs its generic name (RA 6675). An item is sold through the catalog service
  that names it (`service_items.inventory_item_id`); the pharmacy sets only that link, Settings → Services owns the
  service and its price. Suppliers carry their FDA License to Operate.
- **Stock ledger.** `stock_movements` is append-only; every quantity change is one signed row (`+` in, `−` out) with
  `balance_after` = the item's stock on hand at the clinic, every lot, right after it, and the lot's
  `quantity_on_hand` moves in the same transaction. `StockLedgerService` is the only writer: a transaction-scoped
  advisory lock per clinic and item serializes changes, a lot never goes below zero, DISPENSE and CONSUMPTION never
  touch an expired lot (expired from its expiry date on, Manila days). Explicit functions: receiving (RECEIPT),
  dispensing (DISPENSE, linked to the visit and `prescription_item_id`), supplies used on a visit (CONSUMPTION, by visit
  number), count adjustments in / out with a reason, disposing of an expired lot (EXPIRED_DISPOSAL) and damage
  (DAMAGED). A mistake is corrected by another movement. Transfers between clinics are not built.
- **Receiving.** A delivery (DR / supplier invoice nos.) gets the clinic's `STOCK_RECEIPT` number; each line creates its
  lot (lot no., expiry, unit cost) or adds to the same lot on file (another expiry for the same lot no. is refused; an
  expired lot is refused).
- **FEFO.** Without a chosen lot, stock is taken from the unexpired lots with the earliest expiry first (lots without
  an expiry last, then the oldest delivery), split across lots when needed (`stock/stock-rules.ts`).
- **Dispensing.** Issued, unvoided prescriptions of the clinic (ACTIVE, PARTIALLY_DISPENSED) form the queue, oldest
  first. Per line the pharmacist gives the prescribed product or an equivalent generic of the same strength (another
  product is a substitution, written on the movement's reason and the audit row), the lot (FEFO by default) and the
  quantity (at most what is left; the rest later). A dangerous drug needs the S2 form serial, the prescriber's S2
  license and each quantity in words on the Rx. `PrescriptionService.recordDispensed` adds to `dispensed_qty`, links the
  stock item and moves the status to PARTIALLY_DISPENSED / DISPENSED (the issued-Rx lock allows exactly those columns).
  An expired prescription (`valid_until` past) is refused.
- **Billing hook.** `InventoryBillingService.dispensedChargesFor(tx, encounterId)` returns the visit's dispensed items
  (net of patient returns) as lines: item, linked service, quantity, the clinic's service price (else its default,
  else the item's selling price) and tax type, with the ledger rows behind each. Read-only; the cashier decides what
  goes on the invoice.
- **Alerts** (the pharmacy overview, `list_inventory_alerts`): low stock (unexpired stock at or below the reorder
  level), lots with stock expiring within 90 days, expired lots still on the shelf.
- **Desks** (`inventory-access.ts`, `@ClinicAccess({ staffRoles })`): dispensing PHARMACIST / PHARMACY_ASSISTANT;
  receiving, adjusting, write-offs, the item master and suppliers INVENTORY_CLERK; reading stock all three; consumption
  also the clinical desks (doctor, nurse, midwife, lab); clinic admins every desk.

### 5.6 Billing and the cashier desk

`apps/api/src/clinical/billing/` (migration `0003_billing`). The visit invoice is a BIR sales invoice (EOPT Act,
RA 11976); one invoice per visit that is not void.

> **To confirm with the clinic's accountant before real use:** the VAT treatment (VAT-inclusive prices; a non-VAT
> clinic reports every sale as VAT-exempt), which categories take the SC/PWD discount, the order of discounts, the
> creditable withholding rates offered, the professional fee EWT rates (10% default, 5% / 15% per BIR rules) and the
> clinic's share. The rules below are the defaults coded, not tax advice.

- **Charges** ("Load charges", `charges/`): the consultation at the doctor's consult fee at the clinic
  (`practitioner_clinics.consult_fee`, else their default fee), else the item's clinic price (`clinic_service_prices`),
  else `service_items.default_price`; each test ordered (not cancelled) at the price of the item that bills it; the
  medicines dispensed, from Pharmacy's `InventoryBillingService` through the `DISPENSED_CHARGES` port
  (`DispensedChargesSource`). The ledger is append-only, so each line keeps the stock movements it bills
  (`invoice_lines.stock_movement_ids`), a saved draft keeps them, and loading leaves out movements another invoice of the
  visit (not void) already bills. The consultation and PF-shareable items name the doctor and are
  professional fee lines. Loading keeps hand-added lines and the draft's discounts.
- **Totals** (`InvoiceTotalsService`, Decimal, pure): per line, rounded half up to the centavo: gross = qty × price;
  another discount (rate, or an amount spread by gross, the last line taking the centavos left); VAT only at a
  VAT-registered organization: net = charged ÷ 1.12; SC/PWD on an eligible line (consultation, PF, procedure, lab,
  imaging, medicine, supply, vaccine): VAT removed, 20% of the net off, the net reported as VAT-exempt (zero-rated
  stays zero-rated). Then withholding = rate × sales net of VAT; amount due = gross − other − less VAT − SC/PWD −
  withholding; balance = due − paid. The billing tab previews with `computeInvoiceTotals` (`@loopwise/shared/invoice`,
  integer centavos); `invoice-totals.parity.spec.ts` keeps the two equal.
- **Discounts** (`discounts/`): SC/PWD needs the patient's OSCA / PWD ID on file (`patient_identifications`, not
  expired), stored with the ID link, a snapshot of name and number, and the desk user who checked it
  (`approved_by_id`). Employee / promo need a clinic admin's approval, special also a doctor's; never combined with
  SC/PWD (RA 9994 §4).
- **Series and issuing** (`invoice-series/`): admins register ATP / CAS series (range, permit, validity; overlaps
  refused) and can turn one off (`is_active`). A series' state is derived, never stored: INACTIVE (turned off), else
  EXPIRED (past `valid_until`, Manila date), else EXHAUSTED (`next_no` past `end_no`), else ACTIVE. Issuing takes the
  next number of the first usable series in one locked `UPDATE`; refused when every active series is exhausted
  (`INVOICE_SERIES_EXHAUSTED`) or past `valid_until` (`INVOICE_SERIES_EXPIRED`), or when the clinic has series but has
  turned all of them off (`INVOICE_SERIES_INACTIVE`): an internal number outside every registered range is never
  printed. Only a clinic that has registered no series falls back to its INVOICE document sequence. A void keeps its
  number, with who, when and why.
- **Payments** (`payments/`): split tender (CASH with tendered / change, GCASH, MAYA, QR_PH, cards, BANK_TRANSFER,
  CHECK with bank and date, PHILHEALTH packages), each a payment numbered from the PAYMENT sequence, allocated to the
  invoice, on the cashier's open shift (none → `NO_OPEN_SHIFT`). POSTED → VOIDED (admin, reason, only while its shift
  is open; the invoice moves back PAID → PARTIALLY_PAID / ISSUED) or REFUNDED (not offered yet).
- **Shifts** (`cashier-shifts/`): one open shift per cashier per clinic (partial unique index); the X reading is the
  summary by method; the Z reading stores expected cash (float + cash), counted cash by denomination and the variance,
  and closes it.
- **Professional fees** (`professional-fees/`): created on **issue** (the fee is earned by the service billed, so the
  PF report matches the issued invoices of a period): gross = the line net of VAT after discounts; clinic share =
  gross × `practitioner_clinics.clinic_share_rate`; EWT = (gross − share) × `ewt_rate` (10% when unset); net payable =
  the rest. A void cancels unreleased fees (an invoice with a released fee can't be voided). Admins release with a
  payout reference. A doctor sees their own fees.
- **Access**: drafting / issuing: DOCTOR, CASHIER, BILLING_CLERK; payments and shifts: CASHIER, BILLING_CLERK; series,
  voids and PF release: clinic admins (`@ClinicAdmin()`). Migration 0003 lets clinic admins write invoices and fees of
  visits whose patient they don't see (`app_encounter_clinic_id()`); the service then reads the visit header as system
  work, scoped to the admin's clinic.
- **Printed invoice**: `/print/invoice/:id` (registered and trade name, TIN with branch code, VAT / non-VAT, address,
  number, date, buyer, lines, the VAT breakdown, SC/PWD name and ID, the ATP / CAS permit and range), audited
  `invoice.print`.
- **Visit flow**: billing never moves the visit or the queue ticket (no FOR_BILLING → COMPLETED from a payment); the
  cashier closes the ticket from the queue's cashier line, and Scheduling keeps the visit in step. The cashier line
  links each ticket to its visit's billing tab ("Bill").

## 6. Follow-ups

The follow-up (care-case) engine of the original screening-loop design is removed: no pathways, rules engine, cases,
tasks or evidence. A follow-up is now part of the visit:

- **`encounters.follow_up_date` and `disposition`** (sent home, for follow-up, referred, admitted, transferred to the
  ER, expired) record what the doctor decided.
- **The follow-up list** (`apps/api/src/clinical/follow-ups/`, `/follow-ups`): the visits at the clinic whose follow-up
  date is overdue (up to 180 days back by default), due today or within `withinDays` (default 7, at most 60), not
  cancelled, with their disposition and primary diagnosis. A follow-up is **done** once the patient has a later visit
  with the same doctor, or a later booking with that doctor that still stands (cancelled, no-show and rescheduled ones
  don't count, nor the visit's own booking). Computed live on every read by one query (`FollowUpRepository.listDue`,
  `$queryRaw` under row-level security), so there is **no pg-boss job** and no stored list that could go stale; a
  morning list for the desk is the same query. Access: a doctor sees their own follow-ups (as the user); the front desk
  (RECEPTIONIST) the clinic's, optionally one doctor's (as the user: desk roles see the patients with a visit at the
  clinic); a clinic admin the clinic's every follow-up, read as system work after the admin check (admins hold no care
  relationship of their own); others are refused (`FOLLOW_UPS_ACCESS`). Each list is audited (`follow_up.list`).
  **Book follow-up** opens Scheduling's booking dialog with the patient, the visit's doctor, the follow-up date (today
  when passed), a FOLLOW_UP visit and the reason; it books through `bookAppointment`, and the booking takes the row off
  the list. Nothing messages the patient.
- **Referrals** are written from a visit (`referrals.encounter_id` required; the encounter page's Referrals tab): to a practitioner of the organization
  (who then gets a `REFERRAL` care relationship) or to an outside doctor or facility, with specialty, clinical summary
  and urgency. Statuses (`referral-status.ts`): SENT → ACCEPTED | DECLINED | CANCELLED, ACCEPTED → COMPLETED |
  CANCELLED; DRAFT unused. **Answers** (`ReferralResponseService`): `acceptReferral` (a note optional),
  `declineReferral` (the reason), `completeReferral` (the response notes), each one transition that stamps
  `responded_at`, writes `response_notes` and its audit row (`referral.accept` / `.decline` / `.complete`); two
  answers at once get `REFERRAL_MOVED`. An **internal** referral is answered by the practitioner it was sent to
  (`NOT_REFERRAL_RECIPIENT` otherwise); an **external** one is marked by the referring side (staff of the referring
  visit's clinic). The check runs as the user; the write is system work, so a receiving doctor at another clinic of the
  organization can still answer. **Lists** (`referrals(input: { box })`): INBOX (sent to the user's practitioner),
  OUTBOX (sent by them), CLINIC (every referral of the clinic, its admins, read as system work and audited). Page
  `/referrals` with the response dialog.
- **Referral letter** (`referralLetter(id)`, `/print/referral/:id`, browser print): the clinic letterhead and the
  referring doctor's name, PRC and PTR (`PractitionerService.signatory`), the patient, who it is to, the reason, the
  urgency, the clinical summary, and the visit's current diagnoses and issued medicines (from the encounter record).
  Audited as a print (`referral.print`).
- **Results** are reviewed by the doctor in the results inbox; abnormal and critical flags come from the lab. Critical
  values reach the doctor first and never get an automated patient message.

## 7. Wise — the assistant

Staff run their work by chat (text or voice):

- _"New encounter: Maria Santos, 45F, fatigue, BP 140/90. Order HbA1c, FBS, lipids."_
- _"Any results for me to review?"_
- _"Summarise Maria's results since her last visit."_
- _"How many patients did we see this month, by age group, as a chart?"_

**The patient chart is the hub.** `/patients/:id` shows the patient, their encounters and, beside them, **one Wise
chat per clinician per patient** (`Chat.patientId`, `surface = 'patient'`, kept out of the general chat list). Wise is
told about the patient on every message (demographics, identifiers, consent, problems, issued medicines, latest vitals,
the last results and encounters, read as the clinician so row-level security applies, inside a `patient_record` data
block), so the clinician never has to say who the patient is. Memories are never extracted from a chart chat, so
patient details don't leak into other chats. A chart chat is private to its author; the care team shares the chart,
not the conversation. General chats (no patient), and the Wise dock beside every list page, cover questions across
patients.

### 7.1 Rule: AI drafts, a person confirms

Every change to a record — creating, editing or voiding it — is a **proposal card** with Confirm / Edit / Cancel.
Only the confirm button calls the real GraphQL mutation, as the user (RLS and authorization apply). The agent never
saves anything, sends orders, referrals or patient messages by itself, and never says something
is saved before the clinician confirms it (system prompt rule; every propose tool tells the model "Nothing is saved
yet").

How it is enforced:

- **Tools can't write.** Every agent tool declares a kind (`createTool({ kind })`, or `withToolKind` for provider
  tools): `read`, `navigate`, `display` or `propose`. `getTools` refuses a tool without one. Tools reach services only
  through the tool context's frozen read-only facades (`agent/services/tool-services.ts`, an allowlist of read
  methods), and an ESLint rule keeps services, repositories and Prisma out of `agent/tools/`. `tools/registry.spec.ts`
  checks every kind and the allowlist, and runs each propose tool against services that throw on anything else.
  Memory extraction is the one background write: the model can't call it, it isn't clinical, and it is off in chart
  chats.
- **One card shell, three modes** (`tool-calls/proposal-card/`): `create` shows the draft; `update` names the record
  and shows a before → after of each changed field, and can't be confirmed when nothing changes; `destructive` (void,
  remove) needs a reason and a second click. A card never confirms by itself, drops a second Confirm while the first
  runs, and settles once.
- **The API settles each card once.** Confirm sends `wiseOrigin { chatId, toolCallId, toolName, edited }` with the
  normal mutation. `WiseProposalService` checks the tool call is in the user's own chat, made by a tool that may confirm
  that mutation, about the same patient, and not settled; then, in the mutation's transaction, writes
  `wise_proposal_outcomes` (unique per tool call, append-only) and the audit row with `audit_logs.origin`. A second
  Confirm or a Confirm after Cancel (`cancelWiseProposal`) is refused with CONFLICT. `wiseProposalOutcomes(chatId)`
  lets a reopened chat show its cards settled.
- **No stale overwrite.** An update card carries the record's version (bumped by a trigger on every update). The
  mutation takes `expectedVersion` and updates only if it is unchanged; otherwise CONFLICT, and the card offers
  **Re-draft**.
- **Cards with parts.** One tool call may carry several cards: the AI scribe's draft (§7.5). `wiseOrigin.part` names
  the part; a part confirms through the mutation of the card it stands for (`@loopwise/shared/scribe`
  `SCRIBE_PART_TOOLS`), only while both that tool and `propose_scribe_note` are on, and settles once under
  `<toolCallId>#<part>`, so confirming one part leaves the others open. The audit origin records the part, and
  `wiseProposalOutcomes` says whether each draft was edited.

### 7.2 Agent tools

Built:

| Kind     | Tools                                                                                                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| read     | `find_patient`, `list_results_to_review`, `list_lab_orders`, `list_appointments`, `list_queue`, `list_billing`, `find_stock`, `list_inventory_alerts`, `describe_analytics`, `run_analytics_sql`, `get_metric`, `chart_patient_trend`, `create_report`, `load_skill`, `web_search` |
| navigate | `open_page`                                                                                                                                                                                                                                                                        |
| display  | `report`, `clarification`, `suggest_follow_ups`                                                                                                                                                                                                                                    |
| propose  | `propose_patient_registration`, `propose_patient_update`, `propose_encounter`, `propose_encounter_note`, `propose_prescription`, `propose_medical_certificate`, `propose_charges`, `propose_scribe_note` (§7.5), the actions of §7.3, `propose_skill`                              |

Planned with the clinic modules: `propose_dispense`, `propose_referral`, `propose_patient_message`, `get_patient_timeline`.

Notes on the built tools:

- **Encounter record.** `propose_encounter` also takes stated vitals and ICD-10 diagnoses; `propose_encounter_note`,
  `propose_prescription` (allergy warning), `propose_medical_certificate` and `propose_charges` name an encounter by the
  id in the patient record, and Confirm saves a **draft**; issuing a document or an invoice is a separate confirm. They
  become update cards (before → after) when a draft already exists, and save against its `version`. The vitals and diagnoses of a confirmed `propose_encounter` are saved right
  after the encounter with the same `wiseOrigin` (`WiseProposalService.verifyFollowUp`).
- **Registration.** `propose_patient_registration` extracts the details from the conversation, runs the duplicate
  check, and its Confirm calls the same `registerPatient` mutation as the form, after consent.
- **Navigation.** Wise never writes a URL: `open_page` picks a key of the page registry `apps/shared/src/app-pages.ts`
  (key, label, params schema, path), shared by API and frontend. The API validates the params and reads a chart as the
  user (RLS, audited), so a chart the user can't see is refused. The app navigates by itself only when the user asked
  and only once after a live reply; embedded chats never navigate by themselves.
- **Charts and summary reports** (`apps/api/src/clinical/insights/`). Wise never writes a query and never supplies a
  number for these: `chart_patient_trend` (BP, weight/BMI, heart rate, glucose, HbA1c, FBS over N months) and
  `create_report` (patient, encounter or facility panel summary) read fixed datasets as the user and audit them. Wise
  writes only the narrative, refused when it has a number the data lacks. PDFs are printed on the server with headless
  Chrome (`CHROME_PATH`), owner-only, audited `report.export`.
- **Analytics** (`apps/api/src/clinical/analytics/`, safety model in §8). `describe_analytics`, `run_analytics_sql`
  (one validated SELECT run as the user; the model gets 50 rows, the card up to 5,000) and `get_metric` (certified
  metrics, §10). Both draw any Recharts chart type from the result's own columns (`@loopwise/shared/analytics-chart`,
  server-checked); thresholds are asked for by key (HbA1c, fasting glucose or "bp"; fixed guideline cut-offs:
  HbA1c 5.7 / 6.5 %, FBS 100 / 126 mg/dL, BP 140/90), never as numbers.
- **Reports in a side panel** (`agent/tools/report.ts`, `clinical/reports/`, `feature/reports/`). The `report` tool
  writes markdown with blocks that embed tool results of the same chat (`<chart ref/>`, `<table ref/>`,
  `<sections ref/>`, and `<kpi ref column compare label/>` for a headline number: the last row of a column, with the
  change from the row before), checked against the chat; prose, tab titles or KPI labels with a number no embedded
  result holds are refused. Layout as in the base app's stories: `<grid widths="2,1">` places 2–4 blocks side by side
  (stacked in a narrow panel), `<tab title>` splits a report into tabs (then it is tabs only; the PDF prints each tab
  on its own page). The parser is `@loopwise/shared/report-blocks`, and the KPI value and comparison are drawn by
  `report-kpi` in the panel and the PDF alike. **`/reports`** lists the latest version of every report in the user's own
  chats (`myReports`; patient names only while RLS shows them) and opens one in its chat (`?report=<id>`). Each call is
  a new version; the panel has a version menu, Print and PDF. **Save to chart** freezes a patient report version into
  `clinical_documents` (append-only, audited `document.create`).
- Old chats may still hold cards of tools no longer offered to the model (`display_chart`, `display_map`,
  `chart_facility_panel`); their cards still render.

### 7.3 Wise actions and tool settings

**Wise actions.** One definition per action in `@loopwise/shared/wise-actions` (`WISE_ACTIONS`): tool name, the
mutation(s) that confirm it, the record it is about (encounter, patient or result), the card mode (create, update,
destructive), the confirm strength (standard, reason, strong) and a loose input schema for the model.
`createActionTool(def)` (`agent/tools/action-tool.ts`) turns it into a `propose` tool; `propose-action.tsx` and
`propose-record-actions.tsx` render it on the shared `ProposalCard`. The mutation accepts the card only from the tools
the registry names for it (`wiseActionToolsFor(mutation)`), verified at the record's organization and settled in its own
transaction (`WiseProposalService.verifyAction` / `settleAction`, checked against the record's organization). Adding an action: a definition, one `wiseOrigin` on
its mutation, the card's body.

| Tool                     | Confirms with                                                                                              | Mode / confirm                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `propose_vitals`         | `recordVitals` (a visit that exists)                                                                       | create / standard                                                |
| `propose_void_vitals`    | `voidVitals`                                                                                               | destructive / reason                                             |
| `propose_allergy`        | `addAllergy`                                                                                               | create / standard                                                |
| `propose_remove_allergy` | `voidAllergy`                                                                                              | destructive / reason                                             |
| `propose_diagnosis`      | `addDiagnosis` / `updateDiagnosis`                                                                         | create                                                           |
| `propose_void_diagnosis` | `voidDiagnosis`                                                                                            | destructive / reason                                             |
| `propose_order`          | `createDiagnosticOrder` (the tests of one request)                                                         | create / standard; from the clinic's catalog                     |
| `propose_cancel_order`   | `cancelDiagnosticOrder` (per test)                                                                         | destructive / reason (requesting doctor or lab desk)             |
| `propose_lab_order_step` | `markSpecimenCollected` / `startDiagnosticOrderItem` / `releaseDiagnosticResult` / `cancelDiagnosticOrder` | lab desk, general chat; cancel is destructive                    |
| `propose_result_review`  | `reviewResult`                                                                                             | update / standard; critical: strong + note                       |
| `propose_issue_document` | `issuePrescription` / `issueMedicalCertificate`                                                            | strong (signs with the PRC license)                              |
| `propose_void_document`  | `voidPrescription` / `voidMedicalCertificate`                                                              | destructive / reason                                             |
| `propose_bill_step`      | `issueInvoice` / `recordPayment` / `voidInvoice`                                                           | issue strong; payment needs the method and amount; void a reason |
| `propose_save_report`    | `saveReportToChart`                                                                                        | create                                                           |
| `propose_patient_update` | `updatePatient`                                                                                            | contact details only; clinic or hospital staff                   |
| `propose_appointment`    | `bookAppointment` (the front desk picks the slot in the card)                                              | create / standard; chart chat; never messages the patient        |
| `propose_reschedule`     | `rescheduleAppointment` (subject: the appointment from `list_appointments`)                                | update / standard; the old booking is kept as RESCHEDULED        |

Read tools for follow-ups (§6): `list_follow_ups` (the follow-ups due within `withinDays`, default 7, a doctor's own or
the clinic's by doctor; in a chart chat, that patient's) and `list_referrals` (inbox or outbox, pending by default),
both through `FOLLOW_UPS_READER` as the user and audited. Booking a due follow-up reuses `propose_appointment` in the
patient's chart chat (the follow-up's doctor, its date, FOLLOW_UP); answering a referral stays on the Referrals page.

`updatePatient` changes contact details only (mobile no., preferred language, address and barangay); names, birth
date, sex and IDs drive the duplicate match and stay with registration. Never from chat: users, passwords, roles, LLM
config, and the tool settings.

**Wise tool settings** (Settings → Wise tools, `apps/api/src/wise-tools/`).
`@loopwise/shared/wise-tools` catalogues every tool: label, summary, kind, category, `locked`, `comingSoon`, and
whether it is on by default. An organization's admin turns tools on or off; a user can turn a tool off for themselves,
never on past their organization. `wise_tool_settings` stores overrides only; each change is audited. `clarification`,
`find_patient` and `open_page` are locked on. Confirmation is not a setting: nothing turns off the Confirm.

Enforced on the server: the agent leaves turned-off tools out of the model's tool set on every run, the system prompt
lists them so Wise says so rather than fail, and `WiseProposalService.verify` refuses to confirm a card whose tool is
off at the record's organization. `registry.spec.ts` fails when a tool the model can get is missing from the catalogue.
Per-role defaults can follow the staff roles (`user_clinic_roles`) later.

### 7.4 Clinical system prompt (essentials)

- Never diagnose on its own; always cite the result values and reference ranges used.
- Critical values: tell the clinician to act now; never draft a patient message for them.
- Only use tools; never invent patients, results or facilities.
- Ask when patient identity is ambiguous.

### 7.5 AI scribe

The headline feature ([PLAN.md](PLAN.md) §4.3). On the encounter page's **AI scribe** tab (staff who can add to the
visit) the doctor records the consult or types a dictation, picks the language of the patient summary (default: the
patient's preferred language) and presses **Draft with Wise**.

- **One pass, one tool.** The panel sends the transcript to the patient's chart chat (the patient layout shares the
  chart chat's agent with its pages), asking for `propose_scribe_note`. Wise puts every part that was said into that
  one call: the SOAP note in English (chief complaint, HPI, review of systems, subjective, physical exam, objective,
  assessment, plan, onto the encounter's reference columns), vitals said aloud, diagnoses with ICD-10 and their type
  (PRIMARY / SECONDARY / WORKING), the prescription (generic name first, RA 6675; the dangerous-drug flag and quantity
  in words, RA 9165), tests, a medical certificate (type, rest days), the follow-up date or interval and disposition,
  and a plain-language patient summary in English, Filipino or Cebuano. One tool rather than orchestrating the single
  propose tools: those are one card per turn ("never together with another tool") and settle when the clinician's
  next chat message answers them, so eight of them in one turn would settle each other. The model writes one
  structured draft; the API resolves it once.
- **The tool only reads** (`ScribeWiseReader`, as the user, audited `encounter.view`): the visit must be the chat's
  patient's and the user's to add to; each code is checked against `icd10_codes` (an unknown one is flagged for the
  doctor to replace); tests are matched to the organization's catalog (`unmatched` ones are named, not orderable);
  the patient's allergies come back with the drafted medicines that match one.
- **One card per part** on the visit, on the shared `ProposalCard`, each confirmed, edited or dismissed on its own
  through the record's own mutation: SOAP, follow-up and summary through `updateEncounterNote` (an update card,
  before → after, at the note's version; the summary is saved as the visit's patient instructions, a draft for the
  doctor that nothing sends to the patient), vitals `recordVitals`, each diagnosis `addDiagnosis`, the prescription
  `savePrescription` (a draft, at the version of a draft it replaces; allergies shown, a warning on a match), tests
  `createDiagnosticOrder`, the certificate `saveMedicalCertificate` (a draft). Issuing documents stays the doctor's
  own step. A progress line and each settled card say saved (edited) or dismissed; the chat shows a compact card
  linking to the visit. A part confirms only with `wiseOrigin.part` (§7.1).
- **Recording consent.** Before recording the doctor reads the consent text and records the patient's answer:
  `patient_consents` with `encounter_id`, type `PHOTO_VIDEO` (the reference has no "recording" type; PHOTO_VIDEO is
  the one about capturing the patient on media, while TELEMEDICINE is about remote care), the text's version and
  granted or not; the latest answer counts, and withdrawing is a new row. `POST /api/scribe/transcribe` refuses
  without it (`RECORDING_CONSENT_REQUIRED`), audits the upload as EXPORT (`scribe.transcribe`) and keeps no audio.
  Typing a dictation needs no consent.
- **Safety.** Wise only reads or proposes; critical values never get a patient message (the summary never breaks bad
  news); everything is audited with the scribe card and its part as origin. A synthetic demo consult (Maria Santos,
  hypertension and diabetes) is in `@loopwise/shared/scribe-demo`.

Not built yet: dose ranges by age and weight, interaction checks beyond the allergy match, keeping audio (it is never
kept), speech-to-text tuned for Taglish and Cebuano.

## 8. Access control and data governance

1. **Deny by default.** A user sees a patient only through:
    - their own unexpired `CareRelationship` (an encounter they opened or took, a referral to them, a logged
      `BREAK_GLASS` row with a note and an expiry);
    - a desk role at a clinic where the patient has a visit (`RECEPTIONIST`, `NURSE`, `MIDWIFE`, `CASHIER`,
      `BILLING_CLERK`) or an appointment (front desk, nurses, midwives);
    - a lab role (`MEDTECH`, `RADTECH`) at a clinic where the patient has a diagnostic order;
    - a pharmacy role (`PHARMACIST`, `PHARMACY_ASSISTANT`, or the clinic's `ADMIN` / `SUPER_ADMIN`) at a clinic where
      the patient has an issued prescription: read-only, and only the patient row, allergies, that visit and its issued
      prescriptions (which dispensing updates). Added in `0002_inventory` as separate permissive policies
      (`app_pharmacy_can_see_patient()` / `app_pharmacy_can_see_encounter()`), leaving `app_can_see_patient()` as is.
2. **Postgres row-level security** (migration `0001_rls_and_triggers`, `apps/api/src/clinical/rls/`). `asUser` sets
   `app.user_id` and switches to role `loopwise_app` for the transaction. `SECURITY DEFINER` helpers back the policies:
   `app_user_id()`, `app_org_ids()`, `app_clinic_ids()`, `app_clinic_ids_with_role(roles)`, `app_can_see_patient()`,
   and for encounter children `app_can_see_encounter()` (read) and `app_can_write_encounter()` (the visit is also at one
   of the user's clinics). Patient master data goes through its patient; rows below a parent (Rx items, order items,
   results, result values, invoice lines, allocations) through the parent; clinic operations (appointments, queue,
   invoices, payments, stock, schedules) through the clinic; catalogs through the organization. Registration duplicate
   checks, opening a visit (which writes the care relationship), jobs and seeds use `asSystem`. Tests:
   `test/clinical-rls.e2e-spec.ts`, `test/foundation.e2e-spec.ts`. Clinic setup (Settings → Clinic) is for clinic
   admins (`@ClinicAdmin()`; the organization's legal details need its ADMIN or a SUPER_ADMIN): the catalog, clinic
   prices, practitioner links, schedules and numbering are written as the user; what the policies give admins no path
   for (the `organizations` and `clinics` rows, another practitioner's profile or leave, deleting a schedule, leave or
   clinic price) runs as `asSystem` after the service checked the row belongs to the admin's clinic or organization,
   audited with the admin as the user (`test/clinic-setup.e2e-spec.ts`).
3. **Agent scoped the same way.** Tools run with the user's identity. Wise analytics runs SQL over curated `analytics`
   views with four locks Postgres enforces itself: its own login role `loopwise_analyst` (SELECT on `analytics.*` and
   EXECUTE on `analytics.bind` only, a separate pool), views owned by `loopwise_analytics_owner` so the base tables'
   RLS still filters every row, an identity bound per transaction by a one-time token (`app_private`), and a read-only
   transaction with a 5 s timeout and a 5,000-row cap. In front of that, a validator on the real Postgres parser
   (`libpg-query`) accepts one SELECT over the views with allowlisted functions. `pg_stat_activity` is revoked from
   PUBLIC. Viewer-only users get counts under 5 as "<5". Every query is audited (`analytics.query` / `.rejected` /
   `.failed`). Tests: `test/analytics-security.e2e-spec.ts`.
4. **One business per install.** Patients and catalogs belong to the organization and are shared by its clinic
   locations; visits, invoices and stock belong to one clinic, and staff reach them through their clinic roles.
5. **Break-glass** (API not built). The `BREAK_GLASS` care relationship reason exists: a reason, an expiry, an audit
   row.
6. **Audit everything.** Every view and change goes through `AuditService` into `audit_logs` (the base schema's action,
   entity and before/after changes, plus the specific `event`, the reason, the Wise `origin` and the request's
   correlation id). The log is append-only (a trigger rejects UPDATE and DELETE).
7. **Consent.** A `DATA_PRIVACY` consent (RA 10173) is recorded at registration (`patient_consents`, with the version of
   the text); visit-specific consents (procedure, telemedicine, recording a consult) attach to the encounter. Recording
   a consult for the AI scribe is a `PHOTO_VIDEO` consent of the visit (§7.5), checked on the server.
8. **Synthetic data only** in seeds, fixtures and demos.
9. **Data Privacy Act.** Purpose limitation, NPC registration, breach process, and a choice of LLM provider (including
   a self-hosted option) per clinic.

## 9. Integration

| Direction         | Standard                                                            | Notes                                                     |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Internal model    | The PH clinic base schema, FHIR-shaped                              | Ready for FHIR APIs later                                 |
| Reference data    | PSGC (PSA), ICD-10 (WHO, as PhilHealth), PhilHealth RVS, case rates | Seeded samples; load the full publications before a pilot |
| Patient messaging | SMS gateway (provider TBD), later Messenger                         | Planned ([PLAN.md](PLAN.md) §4.6)                         |
| Claims            | PhilHealth eClaims / Konsulta                                       | Schema ready (`philhealth_claims`); planned               |
| HMO               | LOA / approval codes, SOA transmittals                              | Schema ready (`hmo_*`); planned                           |

There is no HL7 interface: the lab is in-house and results are entered on the lab worklist. The HL7 ingest and
outbox, facility API keys and the MLLP edge connector were built earlier and removed. A clinic that runs its own LIS
would need a new interface (results into `diagnostic_results` / `diagnostic_result_values`, which keep
`hl7_message_id` and the parameters' `lis_code` for that).

## 10. Metrics

Owner dashboard ([PLAN.md](PLAN.md) §4.8): patients seen, revenue, no-show rate, wait time, top diagnoses, stock value,
results awaiting review, follow-up dates passed without a visit; the same split by sex, age group and barangay to spot
gaps.

Certified metrics (`apps/api/src/clinical/analytics/metrics.ts`, built): one fixed SQL definition per headline number
over the analytics views (panel size, patients by age band / sex / barangay, new patients, encounters per period, top
diagnoses, results awaiting review, open orders by age, prescriptions issued, billing totals). Wise's `get_metric`
uses them; the dashboard and reports call the same definitions rather than repeat the SQL.

## 11. Base code

Loopwise is built on an agent base (credited in `NOTICE`). Kept from it:

- Agent core, LLM providers (OpenAI, Anthropic, Gemini, Mistral, OpenRouter, OpenAI-compatible), streaming, chat UI.
- `clarification`, `suggest-follow-ups`, `load-skill`, skills (clinical guidelines), memory.
- Attachments (upload previous results as PDF), voice transcription (`apps/api/src/transcribe/`, the scribe's input).
- Auth (better-auth, UUIDv7 ids), organizations and their clinics (the base app's projects), users.
- pg-boss jobs (`@Job`: reminders).
- Charts and analytics.

Module conventions are in [CLAUDE.md](../CLAUDE.md) and §4.5. Modules of the base app that predate those rules
(agent, chats, attachments, charts, skills, user management) are listed in [NEXT.md](NEXT.md) where they differ.

## 12. Assumptions and limitations

- Synthetic data only; clinical cut-offs from published guidelines, to be validated by clinicians before a pilot.
- The PSGC, ICD-10 and RVS rows are samples (the curated ICD-10 list of `@loopwise/shared/icd10`); load the PSA, WHO
  and PhilHealth publications before a pilot. A diagnosis code must exist in `icd10_codes`.
- Duplicate checks run within an organization: the patient number or a PhilHealth ID is an exact match and is never
  registered twice; the same name, birth date and sex is a possible match the clinician confirms.
- Tax rules (VAT treatment of medical services, EWT on professional fees) follow the base schema's notes; check them
  with an accountant.
- Patient messaging is not live yet; real delivery depends on an SMS gateway and local regulation.
- Wise does not make clinical decisions; every action is confirmed by a person.
- Speech-to-text quality for Taglish and Cebuano is unproven ([PLAN.md](PLAN.md) §8).
- Not a medical device.
