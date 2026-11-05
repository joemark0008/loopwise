# Loopwise — Design

> **Run the whole clinic, with an assistant that drafts and a clinician who decides.**

Loopwise is an AI-powered system for Philippine outpatient clinics: front desk, nurse, doctor, lab, pharmacy, cashier
and the patient, with **Wise** (the AI assistant) drafting the work at every desk and a person confirming it. Every
actionable result and follow-up has an owner until it is closed.

This document is the technical design: architecture, data model, the follow-up state machine, Wise, access control and
integration. The product, its users, the module list and the phases are in [PLAN.md](PLAN.md); what is built and what
comes next is in [NEXT.md](NEXT.md).

---

## 1. Product in one page

- **Customer:** private and multi-doctor outpatient clinics in the Philippines (1–10 doctors); later clinic chains,
  diagnostic centers and RHUs. Problem and users: [PLAN.md](PLAN.md) §1–2.
- **What we sell:** less typing, fewer dropped patients, cleaner records. Every desk gets a Wise draft it confirms in
  one click; every result and follow-up has an owner until it is closed.
- **Rules that never bend:** AI drafts, a person confirms (§7.1); deny-by-default access through care relationships
  and Postgres row-level security (§8); every clinical change is an event and every view or action is audited;
  critical values always reach a clinician first; synthetic data only outside a real deployment.
- **Regulatory frame:** Data Privacy Act (RA 10173) and NPC registration, PRC licenses on issued documents, PhilHealth
  (ICD-10, packages, eClaims later), BIR invoicing, senior citizen / PWD discounts.

## 2. A clinic day

The flow Loopwise supports end to end. Built parts are marked; the rest is planned in [PLAN.md](PLAN.md) §4 and §6.

1. **Booking.** A patient books by message, phone or the portal; the receptionist confirms Wise's booking card, or
   registers a walk-in (registration with duplicate check and consent: built). _Appointments and queue: planned._
2. **Check-in and triage.** The patient gets a queue number; the nurse records vitals and the chief complaint, by hand
   or by dictation (vitals: built; queue and triage: planned).
3. **Consult with the AI scribe.** The doctor dictates or records the visit; Wise drafts the SOAP note, diagnoses
   (ICD-10), prescription, lab orders, medical certificate and a patient summary as separate proposal cards, each
   confirmed by the doctor (the cards: built; one-pass scribe: planned).
4. **Lab.** Orders go to the in-house lab worklist or an outside lab over HL7; results come back, the rules engine
   evaluates them and the doctor reviews them in the results inbox (built).
5. **Pharmacy.** The issued prescription lands in the dispense queue; the pharmacist dispenses from stock, which posts
   charges to the bill and counts as evidence that treatment started (planned).
6. **Cashier.** Charges from the visit, discounts, PhilHealth / HMO, payment and invoice (bill, finalize, pay: built;
   HMO, invoices: planned).
7. **Follow-up.** An abnormal result, a follow-up date or a referral opens a follow-up with an owner and a due date;
   the patient is reminded; the follow-up closes on evidence or a clinician's sign-off (planned, §6).

Exceptions that matter:

| Situation                               | What happens                                                              |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Result not reviewed in 48 h             | Escalates to the owner, then the clinic's clinical lead                   |
| Critical value (e.g. K⁺ 6.5, HbA1c 12%) | Skips the queue, alerts a clinician at once; no automated patient message |
| Patient doesn't respond to reminders    | SMS resend → nurse call → marked `lost_to_follow_up`, still counted       |
| Referral rejected (specialist full)     | Back to the sender with the reason → re-route; never ownerless            |
| Someone tries to close early            | Blocked unless evidence exists or a named clinician signs off             |

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

- **One hub, multi-tenant.** Each clinic (and later each branch, lab or pharmacy) is an **organization (tenant)**;
  each staff member is a **user** with a role at that facility.
- Clinics without their own lab use the hub's lab worklist; an outside lab connects over HL7 (§9).
- From one codebase: **cloud SaaS** for independent clinics, or a **self-hosted hub** for a chain or a group that
  must keep data on its own infrastructure.
- A single Docker image: the API also serves the built frontend (`docker-compose.prod.yml`).

### 4.2 Components

```
 Outside lab (LIS)                 Patient (SMS, portal)
        │ HL7 v2 over HTTPS                │
 ┌──────▼─────────────────────────────────▼───────────────────┐
 │ Loopwise hub (NestJS modular monolith)                     │
 │                                                            │
 │  HL7 ingest + patient matching ──► clinical events         │
 │  Rules engine ──► follow-ups (owners, SLAs, escalation)    │
 │  Clinic modules: patients, encounters, orders, results,    │
 │   prescriptions, billing (+ appointments, queue, pharmacy, │
 │   inventory, portal: planned)                              │
 │  Wise agent (proposal cards)   GraphQL API (auth, roles)   │
 │  Postgres (RLS, audit)         pg-boss (timers, reminders) │
 └────────────────────────────────────────────────────────────┘
        │                      │                      │
   Staff web app          Wise chat / dock      Owner dashboard
```

### 4.3 Data flow

1. A result arrives (HL7 `POST /api/hl7/messages`, or entered at the lab worklist); the ingest matches the patient and
   stores it.
2. `ClinicalEventsService` (`apps/api/src/clinical/events/`, in process) publishes `result.received` after commit.
3. `ResultEvaluationSubscriber` runs `RulesService.evaluateAndStore`: the pure `RulesEngine.evaluate`
   (`@loopwise/shared/rules-engine`) against the active pathways, stores a `ResultEvaluation` and publishes
   `result.evaluated` (classification, urgency, next state, SLA).
4. The follow-up engine (planned) opens or advances the follow-up, assigns the owner and starts the SLA timer.
5. Reminders and patient messages go out; replies come back as events.
6. pg-boss checks SLAs and sends reminders; overdue steps escalate.
7. Staff act in the web app or through Wise; every action is audited, every follow-up transition is a `CaseEvent`.

### 4.4 Key decisions

| Decision                                              | Why                                                | Trade-off                                   |
| ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| Shared DB + Postgres RLS (not DB per tenant)          | Simple; referrals across facilities are easy       | Isolation depends on correct RLS; test hard |
| Modular monolith in NestJS                            | Fast to build; modules talk through events         | One deployable                              |
| In-process events (`ClinicalEventsService`)           | No extra infrastructure; a broker can replace it   | Events don't survive a crash mid-handler    |
| HL7 v2 at the edges, FHIR-shaped model inside         | Works with existing LIS, modern core               | Mapping layer                               |
| Rules-first decisions; AI for language and assistance | Safe, explainable                                  | Less "AI magic"                             |
| Built on an existing agent base                       | Agent, chat UI, auth, orgs and jobs already worked | Leftover base code to keep pruning          |

## 5. Data model

Prisma schema split by domain in `apps/api/prisma/schema/*.prisma`.

### 5.1 Clinical core

| Model               | Key fields                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `Organization`      | type: clinic, lab, imaging, hospital, pharmacy, program; `usesHl7Connector`                        |
| `Patient`           | name, birthDate, sex, phone, preferredLanguage, barangay, consentAt                                |
| `PatientIdentifier` | patientId, orgId, system (MRN, PhilHealth ID), value — the patient index                           |
| `CareRelationship`  | patientId, userId, orgId, reason (encounter, order, referral, case_owner), expiresAt               |
| `Encounter`         | patientId, doctorId, orgId, reason, SOAP fields, startedAt, sourceChatId, version                  |
| `ClinicalOrder`     | encounterId, patientId, orderingDoctorId, targetOrgId, code (LOINC/local), priority, status        |
| `Result`            | orderId?, patientId, sourceOrgId, code, value, unit, refRange, flag, rawHl7, resultedAt            |
| `Pathway`           | key (diabetes, breast, potassium), rules (JSON), steps, SLAs, closure requirements                 |
| `ResultEvaluation`  | resultId, pathwayKey, ruleVersion, classification, urgency, reason, guideline, nextState, slaHours |
| `CareCase`          | patientId, pathwayId, triggerResultId, state, urgency, ownerUserId, ownerOrgId, dueAt, closedAt    |
| `CaseEvent`         | caseId, type, fromState, toState, actorUserId/actorOrgId/system, payload, createdAt (append-only)  |
| `Referral`          | caseId, fromOrgId, toOrgId, toUserId?, status (sent/accepted/rejected/booked/seen), reason, apptAt |
| `Task`              | caseId, title, ownerUserId/ownerOrgId, dueAt, status                                               |
| `Evidence`          | caseId, type (result, visit_note, dispense, signoff), refId, recordedBy                            |
| `PatientMessage`    | caseId, patientId, channel, templateKey, language, body, status, ackAt, reply                      |
| `ClinicalDocument`  | a saved report version frozen with its data (append-only)                                          |
| `Hl7Message`        | inbound HL7, idempotent per (org, MSH-10)                                                          |
| `Hl7Outbox`         | outbound ORM^O01 waiting for the lab system's pull                                                 |
| `AuditLog`          | userId, action, patientId?, resource, reason?, origin (e.g. Wise), at (append-only)                |

`CareCase`, `CaseEvent`, `Referral`, `Task`, `Evidence` and `PatientMessage` are in the schema from the original
screening-loop design and now serve the **follow-ups loop** (§6); their modules are not built yet.

Order status: `draft → sent → accepted → collected → resulted → reviewed`, with exits `rejected` (the target facility
refuses, with a reason) and `cancelled` (the ordering doctor, before collection, with a reason). A lab without worklist
steps may result straight from `sent` or `accepted`. The edges live in `apps/api/src/clinical/orders/order-status.ts`
and, for every writer, in the `check_order_transition` trigger (migration `0018_hl7_outbox`).

### 5.2 Pathway rules

`apps/shared/src/pathway-rules.ts`, schema version 2, validated by zod on every load and in the seed. A pathway lists
**triggers**: a result code (LOINC) with either numeric **bands** (`min ≤ x < below`, in one canonical unit, contiguous
from −∞ to +∞ so every value lands in exactly one band; unit aliases and linear conversions such as IFCC mmol/mol →
NGSP % or mmol/L → mg/dL) or coded bands (a value pattern extracts the code, e.g. BI-RADS "Category 4A" → 4). Each band
concludes a classification (`normal` / `actionable` / `critical`), an urgency (`routine` / `soon` / `urgent` /
`critical`), a reason, the guideline it cites, the next state and optionally its own SLA. Plus `criticalFlag` (where a
lab-flagged critical result goes when its band says less), the **steps** (§6) with their SLAs, pathway SLAs (result
review, critical alert) and **closure** requirements.

The rules engine is pure: it normalises units, applies the band, raises any `critical_low` / `critical_high` lab flag
to at least actionable and urgent, and sends a value it cannot read (unknown unit, unreadable value or code) to a
clinician's review instead of dropping it. When several pathways match, the most serious result wins, then the pathway
key. Seeded (synthetic, cited, to be signed off by clinicians): `diabetes` v2 (HbA1c and fasting glucose, ADA 2025;
HbA1c ≥ 12 % critical), `breast` v2 (BI-RADS 0–6, ACR BI-RADS 5th ed.; 4 and 5 go straight to `referred`),
`potassium` v1 (UKKA 2020; K⁺ ≥ 6.5 critical). `result_evaluation` (migration `0019_result_evaluation`) is
append-only, one row per result and rule version, written by system work, readable by exactly the users who can read
the result. `/pathways` shows every band, step and SLA read-only.

### 5.3 Encounter record

Migration `0011_encounter_record`. Each visit carries its own record:

| Model                       | Key fields                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Encounter` (SOAP)          | reason (chief complaint), history, physicalExam, assessment, plan, patientInstructions, followUpOn                                                                           |
| `VitalSigns`                | encounterId, BP, HR, RR, temperatureC, spo2Pct, weightKg, heightCm, bmi (computed), CBG, pain, recordedAt                                                                    |
| `EncounterDiagnosis`        | encounterId, icd10Code (WHO ICD-10 2010, as PhilHealth), display, certainty, isPrimary (one per visit)                                                                       |
| `PatientAllergy`            | patientId, substance, kind, reaction, severity; Rx items are checked against it                                                                                              |
| `Prescription` / `…Item`    | status draft/issued/voided, rxNumber, prescriber + facility snapshot; items: generic (RA 6675), brand?, strength, form, dose, route, frequency, days, quantity, refills, sig |
| `MedicalCertificate`        | status, certificateNumber, examinedOn, diagnosisText, fitness, restFrom/restDays, remarks, purpose, doctor snapshot                                                          |
| `EncounterBill` / `…Charge` | status draft/finalized/paid/voided, charges, senior/PWD discount, PhilHealth package, OR number; one non-voided bill per visit                                               |
| `ClinicianProfile`          | userId, credentials, prcLicenseNumber, ptrNumber (printed on documents; issuing needs the license)                                                                           |

Record rows carry `patientId` and `orgId` and reference the encounter by `(encounter_id, patient_id)`, so they never
point at another patient's visit. Row-level security reaches them through the patient (`app_can_see_patient`); only
staff at the visit's facility write. Wrong entries are voided, never deleted. Issued prescriptions and certificates,
and finalized bills, are locked by triggers (only voiding, or paying a bill, is allowed), even for system work. Every
view and change writes an `AuditLog` row. A pharmacy dispense will point at a `PrescriptionItem` and become `Evidence`
(type `dispense`).

### 5.4 Planned models

Sketch for [PLAN.md](PLAN.md) §4; each lands with its module and migration.

| Area                | Models                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Staff roles         | role on the facility membership (`receptionist`, `nurse`, `doctor`, `lab`, `pharmacist`, `cashier`, `admin`) |
| Clinic setup        | branch, room, service / fee schedule, doctor schedule, PF rules                                              |
| Appointments, queue | `Appointment` (type, slot, status, encounterId), `QueueTicket` (number, station, status)                     |
| Pharmacy, inventory | `Item`, `StockLot` (lot, expiry, quantity), `StockMovement`, `Dispense` (→ `PrescriptionItem`)               |
| Patient portal      | portal account (OTP / magic link), message template, reminder                                                |

## 6. Follow-up state machine

The current `CaseState` enum, from the screening-loop design:

```
open → notified → acknowledged → confirming → referred → accepted → seen → treatment_started → closed
                                                              │
   any state ──► escalated ──► (back to the stuck state once resolved)
   any state ──► lost_to_follow_up (still visible, counted)
```

- Each pathway defines which states apply (e.g. no `confirming` if the result is already diagnostic: diabetes has
  `confirming`, breast doesn't, and a BI-RADS 4 goes straight to `referred`). The schema checks that steps run from
  `open` to `closed`, each once, and that every band's next state is one of them (or `escalated`).
- Each state has an SLA and an escalation rule. The rules engine's evaluation carries the next state and its SLA (the
  band's own, else the step's; `escalated` uses the pathway's critical alert SLA); the follow-up engine applies them.
- `closed` requires `Evidence` (confirmatory result, visit note, dispense) **or** a clinician `signoff` with a reason.
- Normal results: `reviewed → notified → closed` (short loop).
- Follow-ups also come from the scribe's follow-up date and from referrals, not only from results.

[PLAN.md](PLAN.md) §4.5 proposes a smaller clinic-facing set (`open → contacted → booked → seen → closed`, plus
`overdue` and `lost`). Whether to trim the enum or map the clinic labels onto it is decided when the module is built.

## 7. Wise — the assistant

Staff run their work by chat (text or voice):

- _"New encounter: Maria Santos, 45F, fatigue, BP 140/90. Order HbA1c, FBS, lipids."_
- _"Any results for me to review?"_
- _"Explain Maria's results and suggest next steps."_
- _"Which of my patients are overdue for follow-up?"_
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
saves anything, sends orders, referrals or patient messages, or closes a follow-up by itself, and never says something
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
  `wise_proposal_outcome` (unique per tool call, append-only) and the audit row with `audit_log.origin`. A second
  Confirm or a Confirm after Cancel (`cancelWiseProposal`) is refused with CONFLICT. `wiseProposalOutcomes(chatId)`
  lets a reopened chat show its cards settled.
- **No stale overwrite.** An update card carries the record's version (bumped by a trigger on every update). The
  mutation takes `expectedVersion` and updates only if it is unchanged; otherwise CONFLICT, and the card offers
  **Re-draft**.

### 7.2 Agent tools

Built:

| Kind     | Tools                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| read     | `find_patient`, `explain_result`, `list_results_to_review`, `list_lab_orders`, `describe_analytics`, `run_analytics_sql`, `get_metric`, `chart_patient_trend`, `create_report`, `load_skill`, `web_search`              |
| navigate | `open_page`                                                                                                                                                                                                             |
| display  | `report`, `clarification`, `suggest_follow_ups`                                                                                                                                                                         |
| propose  | `propose_patient_registration`, `propose_patient_update`, `propose_encounter`, `propose_encounter_note`, `propose_prescription`, `propose_medical_certificate`, `propose_charges`, the actions of §7.3, `propose_skill` |

Planned with the clinic modules: `propose_appointment` / `propose_reschedule`, the scribe's one-pass card set,
`propose_dispense`, `propose_follow_up`, `propose_referral`, `propose_patient_message`, `propose_close_follow_up`,
`list_my_follow_ups`, `get_patient_timeline`.

Notes on the built tools:

- **Encounter record.** `propose_encounter` also takes stated vitals and ICD-10 diagnoses; `propose_encounter_note`,
  `propose_prescription` (allergy warning), `propose_medical_certificate` and `propose_charges` name an encounter by the
  id in the patient record, and Confirm saves a **draft**; issuing a document or finalizing a bill is a separate
  confirm. They become update cards (before → after) when a draft already exists, and save against its `version`
  (migration `0014_wise_record_versions`). The vitals and diagnoses of a confirmed `propose_encounter` are saved right
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
  server-checked); thresholds are asked for by key (a pathway's LOINC code, or "bp"), never as numbers.
- **Explaining a result.** `explain_result(resultId)` returns the rules engine's evaluation (stored, or computed by the
  same engine), read as the user and audited `result_evaluation.view`. Wise quotes the reason and the guideline; it
  never classifies a result itself.
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
  `clinical_document` (append-only, audited `document.create`).
- Old chats may still hold cards of tools no longer offered to the model (`display_chart`, `display_map`,
  `chart_facility_panel`); their cards still render.

### 7.3 Wise actions and tool settings

**Wise actions.** One definition per action in `@loopwise/shared/wise-actions` (`WISE_ACTIONS`): tool name, the
mutation(s) that confirm it, the record it is about (encounter, patient or result), the card mode (create, update,
destructive), the confirm strength (standard, reason, strong) and a loose input schema for the model.
`createActionTool(def)` (`agent/tools/action-tool.ts`) turns it into a `propose` tool; `propose-action.tsx` and
`propose-record-actions.tsx` render it on the shared `ProposalCard`. The mutation accepts the card only from the tools
the registry names for it (`wiseActionToolsFor(mutation)`), verified at the record's facility and settled in its own
transaction (`WiseProposalService.verifyAction` / `settleAction`). Adding an action: a definition, one `wiseOrigin` on
its mutation, the card's body.

| Tool                     | Confirms with                                                           | Mode / confirm                                       |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| `propose_vitals`         | `recordVitals` (a visit that exists)                                    | create / standard                                    |
| `propose_void_vitals`    | `voidVitals`                                                            | destructive / reason                                 |
| `propose_allergy`        | `addAllergy`                                                            | create / standard                                    |
| `propose_remove_allergy` | `voidAllergy`                                                           | destructive / reason                                 |
| `propose_diagnosis`      | `addDiagnosis` / `updateDiagnosis`                                      | create                                               |
| `propose_void_diagnosis` | `voidDiagnosis`                                                         | destructive / reason                                 |
| `propose_order`          | `createEncounterOrders` (batch)                                         | create / standard; the clinician picks the lab       |
| `propose_cancel_order`   | `cancelOrder`                                                           | destructive / reason (the ordering doctor)           |
| `propose_lab_order_step` | `acceptOrder` / `markOrderCollected` / `rejectOrder`                    | lab staff, general chat; reject is destructive       |
| `propose_result_review`  | `reviewResult`                                                          | update / standard; critical: strong + note           |
| `propose_issue_document` | `issuePrescription` / `issueMedicalCertificate`                         | strong (signs with the PRC license)                  |
| `propose_void_document`  | `voidPrescription` / `voidMedicalCertificate`                           | destructive / reason                                 |
| `propose_bill_step`      | `finalizeEncounterBill` / `markEncounterBillPaid` / `voidEncounterBill` | finalize strong; pay needs the OR no.; void a reason |
| `propose_save_report`    | `saveReportToChart`                                                     | create                                               |
| `propose_patient_update` | `updatePatient`                                                         | contact details only; clinic or hospital staff       |

`updatePatient` changes contact details only (phone, preferred language, barangay); names, birth date, sex and
identifiers drive the duplicate match and stay with registration. Never from chat: users, passwords, facility keys,
LLM config, and the tool settings.

**Wise tool settings** (Settings → Wise tools, `apps/api/src/wise-tools/`, migration `0020_wise_tool_settings`).
`@loopwise/shared/wise-tools` catalogues every tool: label, summary, kind, category, `locked`, `comingSoon`, and its
default per facility type. A facility's admin turns tools on or off; a user can turn a tool off for themselves, never
on past their facility. `wise_tool_setting` stores overrides only; each change is audited. `clarification`,
`find_patient` and `open_page` are locked on. Confirmation is not a setting: nothing turns off the Confirm.

Enforced on the server: the agent leaves turned-off tools out of the model's tool set on every run, the system prompt
lists them so Wise says so rather than fail, and `WiseProposalService.verify` refuses to confirm a card whose tool is
off at the record's facility. `registry.spec.ts` fails when a tool the model can get is missing from the catalogue.
Per-role defaults come with staff roles ([PLAN.md](PLAN.md) §4.1).

### 7.4 Clinical system prompt (essentials)

- Never diagnose on its own; always cite the result values and reference ranges used.
- Critical values: tell the clinician to act now; never draft a patient message for them.
- Only use tools; never invent patients, results or facilities.
- Ask when patient identity is ambiguous.

## 8. Access control and data governance

1. **Deny by default.** A user sees a patient only with a `CareRelationship` (encounter, order, accepted referral,
   case owner).
2. **Postgres row-level security** (migration `0006_clinical_rls`, `apps/api/src/clinical/rls/`). `asUser` switches
   to role `loopwise_app` for the transaction with the user bound; `SECURITY DEFINER` helpers (`app_user_id()`,
   `app_org_ids()`, `app_can_see_patient()`, `app_can_see_case()`) back the policies on every clinical table.
   Registration, HL7 ingest and jobs use `asSystem`. App bugs can't leak other patients.
3. **Agent scoped the same way.** Tools run with the user's identity. Wise analytics (migration `0015_analytics`) runs
   SQL over curated `analytics` views with four locks Postgres enforces itself: its own login role `loopwise_analyst`
   (SELECT on `analytics.*` and EXECUTE on `analytics.bind` only, a separate pool), views owned by
   `loopwise_analytics_owner` so the base tables' RLS still filters every row, an identity bound per transaction by a
   one-time token (`app_private`), and a read-only transaction with a 5 s timeout and a 5,000-row cap. In front of
   that, a validator on the real Postgres parser (`libpg-query`) accepts one SELECT over the views with allowlisted
   functions. `pg_stat_activity` is revoked from PUBLIC. Program-office users get counts under 5 as "<5". Every query
   is audited (`analytics.query` / `.rejected` / `.failed`). Tests: `test/analytics-security.e2e-spec.ts`.
4. **Tenant isolation.** Labs see only orders sent to them; pharmacies only their prescriptions.
5. **Break-glass** (not built). Access without a relationship requires a reason, is time-limited, logged and flagged.
6. **Audit everything.** Every view and action → `AuditLog`; every follow-up transition → `CaseEvent`. Both are
   append-only (a trigger rejects UPDATE and DELETE).
7. **Consent.** Captured at registration (and for recording a consult, with the scribe); patients will see who
   accessed their record in the portal.
8. **Synthetic data only** in seeds, fixtures and demos.
9. **Data Privacy Act.** Purpose limitation, NPC registration, breach process, and a choice of LLM provider (including
   a self-hosted option) per clinic.

## 9. Integration

| Direction            | Standard                                              | Notes                                             |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Orders → outside lab | HL7 v2 ORM^O01 via the outbox                         | Or the lab worklist for labs without a system     |
| Results → hub        | HL7 v2 ORU^R01 over HTTPS (`POST /api/hl7/messages`)  | Lab (LOINC where available) and radiology reports |
| Internal model       | FHIR-shaped (Patient, ServiceRequest, Observation, …) | Ready for FHIR APIs later                         |
| Patient messaging    | SMS gateway (provider TBD), later Messenger           | Planned ([PLAN.md](PLAN.md) §4.6)                 |
| Claims               | PhilHealth eClaims / Konsulta                         | Planned (Phase 5)                                 |

Lab systems authenticate with a **facility key**: an org admin issues it with `createFacilityKey` (shown once; only
its sha256 hash is stored, `apps/api/src/facility-keys/`), and the REST endpoints take it as
`Authorization: Bearer <key>` (`@FacilityKey()`). An MLLP edge connector was built and later removed (5 Nov 2026); a
lab system that only speaks MLLP needs an MLLP-to-HTTPS bridge in front of these endpoints.

**Ingest contract.** `POST /api/hl7/messages` with a `text/plain` body holding one HL7 v2 message (segments separated
by `\r`, no MLLP framing). The answer is 200 with an HL7 ACK (MSH + MSA, ERR on errors): `AA` stored, `AE` a valid
message that could not be stored (e.g. no matching patient), `AR` not a message the hub takes. AE and AR are final;
senders retry only on 5xx. A resend of the same MSH-10 from the same facility gets the same ACK and stores nothing twice
(`hl7_message`, migration `0017_hl7_ingest`). Patients are matched deterministically: an identifier the sending
facility issued, then a PhilHealth number, then the patient of the order the message answers (placer number = the
Loopwise order id); any conflict is an AE left for review. Each stored result writes an audit row and publishes
`result.received`.

**Orders out.** An order for a facility with `uses_hl7_connector` is queued as HL7 v2.3.1 ORM^O01 in `hl7_outbox` in
the transaction that sends it (ORC-1 `NW`; `CA` when the doctor cancels). PID-3 carries the patient's identifier at
the target facility first, then the MRN, PhilHealth and the hub id (`LOOPWISE`, type `PI`); ORC-2 and OBR-2 carry the
order id as placer number; OBR-4 the LOINC code (`LN`). The lab system pulls `GET /api/hl7/outbox?limit=20` with its
facility key and posts its ACK to `POST /api/hl7/outbox/:id/ack` (`AA` → delivered, `AE`/`AR` → failed; a message
stays pending until acknowledged). Status updates from the lab system (ORM/OML, ORC-1 `SC` with ORC-5 `IP`/`CM`) map to
accepted/collected (`OrderService.applyLabStatus`). Facilities without HL7 use the lab worklist (`/orders`).

## 10. Metrics

Owner dashboard ([PLAN.md](PLAN.md) §4.8): patients seen, revenue, no-show rate, wait time, top diagnoses, stock value,
open and overdue follow-ups. Follow-ups loop: time to result review, to patient contact and to the next visit;
documented closure rate; drop-off by step; the same split by sex, age group and barangay to spot gaps.

Certified metrics (`apps/api/src/clinical/analytics/metrics.ts`, built): one fixed SQL definition per headline number
over the analytics views (panel size, patients by age band / sex / barangay, new patients, encounters per period, top
diagnoses, results awaiting review, open orders by age, overdue follow-ups, prescriptions issued, billing totals,
`screening_funnel`). Wise's `get_metric` uses them; the dashboard and reports call the same definitions rather than
repeat the SQL.

## 11. Base code

Loopwise is built on an agent base (credited in `NOTICE`). Kept from it:

- Agent core, LLM providers (OpenAI, Anthropic, Gemini, Mistral, OpenRouter, OpenAI-compatible), streaming, chat UI.
- `clarification`, `suggest-follow-ups`, `load-skill`, skills (clinical guidelines), memory.
- Attachments (upload previous results as PDF), voice transcription (`apps/api/src/transcribe/`, the scribe's input).
- Auth (better-auth), organizations (facilities), users, projects.
- pg-boss jobs (`@Job`: SLA timers, escalations, reminders).
- Charts and analytics (de-identified counts for program views).

Module conventions are in [CLAUDE.md](../CLAUDE.md): one folder per feature under `apps/api/src/clinical/`, thin
resolvers, logic in services, Prisma only in repositories, kebab-case files.

## 12. Assumptions and limitations

- Synthetic data only; clinical thresholds from published guidelines, to be validated by clinicians before a pilot.
- Patient matching is deterministic: the facility MRN or the PhilHealth number is an exact match and is never
  registered twice; the same name, birth date and sex is a possible match the clinician confirms. A match the
  clinician cannot see yet is shown masked and can be linked, which adds a care relationship and an audit row.
- Patient messaging is not live yet; real delivery depends on an SMS gateway and local regulation.
- Facilities without HL7 use web screens.
- Wise does not make clinical decisions; every action is confirmed by a person.
- Speech-to-text quality for Taglish and Cebuano is unproven ([PLAN.md](PLAN.md) §8).
- Not a medical device.
