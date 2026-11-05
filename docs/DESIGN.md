# Loopwise — Design

> **Every result, followed through.**

Loopwise makes sure every ordered test and every actionable screening result becomes timely care, with a clear owner at
each step, safe AI help for doctors, and documented closure across providers.

| Item               | Value                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Competition        | Future Health Digital Innovation Challenge (Hack2skill, Future Health – Abu Dhabi) |
| Focus area         | Population Health                                                                  |
| Challenge          | **Closing the Screening-to-Care Loop**                                             |
| Registration close | 10 Nov 2026                                                                        |
| Prototype due      | 20 Nov 2026 (working prototype + technical docs + assumptions and limitations)     |
| Evaluation         | 20–30 Nov 2026; top 3 present at GITEX (7–11 Dec 2026)                             |
| Prizes             | USD 50k / 35k / 20k                                                                |
| Team               | Up to 5, lead 18+                                                                  |
| Base code          | NestJS 11, GraphQL, Prisma, React                                                  |

---

## 1. Problem

A screening result only creates value if it leads to care. Today the journey crosses labs, imaging, primary care,
specialists, hospitals, pharmacies and the patient, and it breaks at the handoffs:

- Results are communicated inconsistently, or not at all.
- Patients don't understand the result or the urgency.
- Referrals don't turn into appointments; patients move between providers.
- Nobody clearly owns the next step.
- There is no proof the needed care happened, and no view of where patients drop off.

Three gaps we close:

1. **Ordered but not done** — the patient never went for the test.
2. **Done but not reviewed** — the result sits unread.
3. **Reviewed but not acted on** — the actionable result never becomes care (the challenge's core).

## 2. Challenge mapping

| Desired outcome (from the brief)              | How Loopwise delivers it                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| End-to-end case visibility                    | Every order/result is a **case** with a state machine and a full timeline        |
| Clear ownership and timely progression        | One accountable owner per step, SLA per step, overdue/rejected/unassigned queues |
| Patient-centred communication and reassurance | Tiered, non-alarming messages in the patient's language; acknowledgement; Q&A    |
| Cross-provider consultation and coordination  | Referrals with accept/reject, e-consult, shared case across tenants              |
| Safe, human-governed escalation               | Critical values go to a human; closure needs evidence or a clinician sign-off    |
| Closure and patient impact measures           | Dashboard: time to notify/consult/care, completion rates, drop-offs, confidence  |

Judging criteria and where we score:

| Criterion                               | Our answer                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Health impact and clinical relevance    | Guideline-based pathways (diabetes, CKD, breast screening), real workflows   |
| Technical depth and architecture        | Real HL7 v2 pipeline, event-driven case engine, multi-tenant RLS             |
| Working solution and demo quality       | End-to-end live demo across 3 simulated facilities                           |
| Responsible AI, safety, data governance | AI drafts / human confirms, deny-by-default access, full audit               |
| Scalability and deployment readiness    | Containerised, Kubernetes, SaaS or sovereign deployment, same codebase       |
| Commercial viability and path to pilot  | Plugs into existing LIS/RIS/EMR; one lab + one clinic + one specialist pilot |

## 3. Who uses it

| Role                      | Interface                     | Does                                                      |
| ------------------------- | ----------------------------- | --------------------------------------------------------- |
| Doctor (ordering/primary) | **Wise** chat + inbox         | Encounters, orders, reviews results, refers, closes cases |
| Specialist                | Referral inbox + Wise         | Accepts/rejects referrals, records visit, e-consult       |
| Nurse / care coordinator  | Worklist                      | Calls patients, assigns referrals, handles overdue cases  |
| Lab / radiology           | Connector (HL7) or web screen | Receives orders, marks collected/done, sends results      |
| Pharmacy                  | Connector or web screen       | Confirms dispense (evidence of treatment started)         |
| Patient                   | SMS / Messenger + secure link | Gets guidance, acknowledges, asks questions, books visits |
| Program manager / DOH     | Dashboard                     | Loop-closure metrics, drop-offs, equity                   |
| Barangay health worker    | Simple task list (mobile web) | Home visits for unreachable patients                      |

## 4. End-to-end flow

### 4.1 Happy path — Maria, 45, Tagbilaran health center

1. **Checkup.** Dr. Reyes sees Maria (fatigue, frequent urination, BP 140/90). In Wise: _"Order HbA1c, FBS, lipid
   profile at Bohol Diagnostics."_ Wise shows a draft order card; the doctor confirms.
2. **Order sent.** The lab receives it (HL7 ORM/OML via connector, or web screen) and accepts it.
3. **Patient notified.** SMS: where to go, fasting instructions, booking link.
4. **Test done.** Lab marks specimen collected.
5. **Result returns** (HL7 ORU) to Dr. Reyes's _results to review_ inbox. HbA1c 7.2%.
6. **Doctor reviews.** Wise summarises and flags it as actionable (diabetes range). Doctor confirms → **care loop**
   starts.
7. **Patient informed safely.** Moderate result → nurse calls first; SMS only invites her to discuss results. She taps
   _I understand_.
8. **Confirmation.** Repeat FBS ordered → confirms diabetes.
9. **Referral.** To internist Dr. Cruz → accepted → appointment booked.
10. **Seen.** Dr. Cruz records the visit and a treatment plan.
11. **Treatment started.** Pharmacy dispenses metformin → evidence attached.
12. **Closed.** Dr. Reyes signs off. Follow-up tasks created (HbA1c in 3 months).

### 4.2 Exceptions (the real value)

| Situation                               | What happens                                                              |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Test ordered but not done in 7 days     | Patient reminder → then staff alert                                       |
| Result not reviewed in 48h              | Escalates to clinic head                                                  |
| Patient doesn't acknowledge in 48h      | SMS resend → nurse call → barangay health worker home visit               |
| Referral rejected (clinic full)         | Back to sender with reason → re-route; case never ownerless               |
| Critical value (e.g. K+ 6.5, HbA1c 12%) | Skips queue, alerts a clinician immediately; no automated patient message |
| Patient moves to another provider       | Receiving facility accepts the handoff; the case follows the patient      |
| Someone tries to close early            | Blocked unless evidence exists or a named clinician signs off             |
| Patient unreachable after all steps     | State `lost_to_follow_up`, still visible and counted                      |

### 4.3 Departments

- **Lab** and **radiology** are result sources (HL7 ORU from LIS/RIS).
- **Pharmacy** supplies evidence of treatment start (dispense event).
- **Treatment plan** = a short list of care-plan tasks after closure (full chronic-care management is Phase 2).

## 5. Patient communication principles

The patient never learns bad news from a machine.

| Severity        | Example                    | Channel                                                          |
| --------------- | -------------------------- | ---------------------------------------------------------------- |
| Normal          | All within range           | Reassuring SMS, case closed                                      |
| Mild/borderline | Slightly high cholesterol  | SMS invite to routine follow-up; explanation behind secure link  |
| Moderate        | Possible diabetes          | Human (phone/visit) first; system only books and tracks the talk |
| Serious         | Suspected cancer, critical | Always a clinician, never automated; system ensures it happens   |

- SMS **invites**, never diagnoses: no numbers, no disease names.
- Plain Cebuano / Filipino / English (plus Arabic for the Abu Dhabi context). Next step first.
- Templates approved by clinicians; the AI only works inside approved wording.
- Worried replies escalate to a human.
- After closure: one-tap _"Did you feel informed and supported?"_ (patient confidence metric).

## 6. Architecture

### 6.1 Deployment model

**One central hub per network (multi-tenant)**, plus a small **edge connector** at each facility.

- Not one deployment per doctor or per hospital: that recreates the fragmentation the challenge is about and is an
  operations burden.
- Each facility is an **organization (tenant)**. For a clinic group the organization is the company that runs the
  branches; each branch is a **clinic** inside it, holding the staff's chats, LLM settings, saved prompts, members and
  user groups. Clinical data stays scoped by the organization (`orgId`), not by clinic. Each doctor is a **user**.
  (Clinics were called projects before; the `project*` tables and columns keep their names.)
- Facilities keep their LIS/RIS/EMR. Facilities with no system use the hub's web screens.
- Deployment options from one codebase:
    - **Cloud SaaS** for private networks and HMOs.
    - **Sovereign / self-hosted hub** for a government or large network (e.g. alongside an HIE such as Abu Dhabi's
      Malaffi, as a complement, not a competitor).

### 6.2 Components

```
 Lab (LIS)      Hospital (RIS/EMR)      Pharmacy
     │                 │                    │
     └──────── Edge connector (per facility) ┘   HL7 MLLP in, HTTPS out, local retry queue
                       │
 ┌─────────────────────▼──────────────────────────────────────┐
 │ Loopwise hub (multi-tenant, Kubernetes)                    │
 │                                                            │
 │  Ingest + normalise ──► Event bus (NATS JetStream)         │
 │   HL7 v2 → FHIR-shaped    │                                │
 │   patient matching        ▼                                │
 │  Rules engine ──► Case engine ──► Messaging (SMS/Messenger)│
 │  actionable? urgency?  states, owners, SLAs, escalation    │
 │                                                            │
 │  Wise agent                  GraphQL API (auth, roles)     │
 │  Postgres (RLS, audit)       pg-boss (SLA timers, jobs)    │
 └────────────────────────────────────────────────────────────┘
        │                  │                     │
     Patient          Staff web app          Dashboard
  (SMS, secure link)  (Wise, worklists)     (program metrics)
```

The edge connector is `apps/connector`: one Node process and one SQLite file per facility, no other runtime
dependency, so it runs on a small box or a Docker host next to the LIS (§11).

### 6.3 Data flow

1. Facility system → HL7 message → edge connector (buffers if hub unreachable).
2. Ingest converts to an internal FHIR-shaped model, matches the patient, publishes `order.*` / `result.received`.
3. Rules engine evaluates the result against the pathway → `case.actionable` with urgency. Built (in process, not
   NATS): `ResultEvaluationSubscriber` takes each `result.received`, `RulesService.evaluateAndStore` runs the pure
   `RulesEngine.evaluate` (`@loopwise/shared/rules-engine`) against the active pathways, stores a `ResultEvaluation`
   and publishes `result.evaluated` (classification, urgency, next state, SLA) for the case engine.
4. Case engine opens/advances the case, assigns the owner, starts SLA timers.
5. Messaging sends the appropriate patient message; replies come back as events.
6. pg-boss checks SLAs every minute → escalations.
7. Staff act in the web app / Wise; every action is an audited `CaseEvent`.

### 6.4 Key decisions

| Decision                                              | Why                                                      | Trade-off                                   |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| Shared DB + Postgres RLS (not DB per tenant)          | Simple, cross-facility referrals are easy                | Isolation depends on correct RLS; test hard |
| Modular monolith in NestJS for the prototype          | Fast to build; modules talk via events → can split later | One deployable                              |
| NATS JetStream for events                             | Durable, decouples HL7 from case logic, already in use   | One more component (optional for demo)      |
| HL7 v2 at the edges, FHIR-shaped model inside         | Works with legacy LIS/RIS, modern core                   | Mapping layer                               |
| Rules-first decisions; AI for language and assistance | Safe, explainable                                        | Less "AI magic", but scores on safety       |
| Build on an existing agent base                       | Agent, chat UI, auth, orgs, jobs already working         | Must strip unused modules                   |

## 7. Data model (Prisma, new clinical models)

| Model               | Key fields                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `Organization`      | type: clinic, lab, imaging, hospital, pharmacy, program                                               |
| `Patient`           | name, birthDate, sex, phone, preferredLanguage, consentAt                                             |
| `PatientIdentifier` | patientId, orgId, system (MRN, PhilHealth ID), value — the patient index                              |
| `CareRelationship`  | patientId, userId, orgId, reason (encounter, order, referral, case_owner), expiresAt                  |
| `Encounter`         | patientId, doctorId, orgId, reason, notes, startedAt, sourceChatId (the chart chat it was drafted in) |
| `Order`             | encounterId, patientId, orderingDoctorId, targetOrgId, code (LOINC/local), priority, status           |
| `Result`            | orderId?, patientId, sourceOrgId, code, value, unit, refRange, flag, rawHl7, resultedAt               |
| `Pathway`           | key (diabetes, ckd, breast), rules (JSON), steps, SLAs, closure requirements                          |
| `ResultEvaluation`  | resultId, pathwayKey, ruleVersion, classification, urgency, reason, guideline, nextState, slaHours    |
| `Case`              | patientId, pathwayId, triggerResultId, state, urgency, ownerUserId, ownerOrgId, dueAt, closedAt       |
| `CaseEvent`         | caseId, type, fromState, toState, actorUserId/actorOrgId/system, payload, createdAt (append-only)     |
| `Referral`          | caseId, fromOrgId, toOrgId, toUserId?, status (sent/accepted/rejected/booked/seen), reason, apptAt    |
| `Task`              | caseId, title, ownerUserId/ownerOrgId, dueAt, status                                                  |
| `Evidence`          | caseId, type (result, visit_note, dispense, signoff), refId, recordedBy                               |
| `PatientMessage`    | caseId, patientId, channel, templateKey, language, body, status, ackAt, reply                         |
| `AuditLog`          | userId, action, patientId?, resource, reason?, at                                                     |

Order status: `draft → sent → accepted → collected → resulted → reviewed`.

**Pathway rules** (`apps/shared/src/pathway-rules.ts`, schema version 2, validated by zod on every load and in the
seed). A pathway lists **triggers**: a result code (LOINC) with either numeric **bands** (`min ≤ x < below`, in one
canonical unit, contiguous from −∞ to +∞ so every value lands in exactly one band; unit aliases and linear conversions
such as IFCC mmol/mol → NGSP % or mmol/L → mg/dL) or coded bands (a value pattern extracts the code, e.g. BI-RADS
"Category 4A" → 4). Each band concludes a classification (`normal` / `actionable` / `critical`), an urgency
(`routine` / `soon` / `urgent` / `critical`), a reason, the guideline it cites, the next case state and optionally its
own SLA. Plus `criticalFlag` (where a lab-flagged critical result goes when its band says less), the **steps** (§8)
with their SLAs, pathway SLAs (result review, critical alert) and **closure** requirements. The rules engine is pure:
it normalises units, applies the band, raises any `critical_low` / `critical_high` lab flag to at least actionable and
urgent, and sends a value it cannot read (unknown unit, unreadable value or code) to a clinician's review instead of
dropping it. When several pathways match, the most serious result wins, then the pathway key. Seeded (synthetic,
cited, to be signed off by clinicians): `diabetes` v2 (HbA1c and fasting glucose, ADA 2025; HbA1c ≥ 12 % critical),
`breast` v2 (BI-RADS 0–6, ACR BI-RADS 5th ed.; 4 and 5 go straight to `referred`), `potassium` v1 (UKKA 2020; K⁺ ≥ 6.5
critical). `result_evaluation` (migration `0019_result_evaluation`) is append-only, one row per result and rule
version, written by system work, readable by exactly the users who can read the result (the policy looks the result
up under its own RLS). `/pathways` shows every band, step and SLA read-only. Exits: the target facility **rejects**
a sent order (with a reason), the ordering doctor **cancels** it before collection (with a reason). A lab without
worklist steps may result straight from `sent` or `accepted`. The edges live in `apps/api/src/clinical/orders/order-status.ts`
and, for every writer, in the `check_order_transition` trigger (migration `0018_hl7_outbox`).

**The encounter record** (migration `0011_encounter_record`). Each visit carries its own record:

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

Rules: record rows carry `patientId` and `orgId` and reference the encounter by `(encounter_id, patient_id)`, so they
never point at another patient's visit. Row-level security reaches them through the patient (`app_can_see_patient`);
only staff at the visit's facility write. Wrong entries are voided, never deleted. Issued prescriptions and
certificates, and finalized bills, are locked by triggers (only voiding, or paying a bill, is allowed), even for
system work. Every view and change writes an `AuditLog` row. Labs and imaging reuse `Order`/`Result`: the encounter
orders a test (`createEncounterOrder`, sent to the facility) and shows its results; HL7 and result review belong to the
orders/results feature. A later pharmacy dispense points at a `PrescriptionItem` and becomes `Evidence` (type
`dispense`).

## 8. Case state machine

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
  band's own, else the step's; `escalated` uses the pathway's critical alert SLA); the case engine applies them.
- `closed` requires `Evidence` (confirmatory result, visit note, dispense) **or** a clinician `signoff` with reason.
- Normal results: `reviewed → notified → closed` (short loop).

## 9. Wise — the doctor's assistant

Doctors run their work by chat (text or voice):

- _"New encounter: Maria Santos, 45F, fatigue, BP 140/90. Order HbA1c, FBS, lipids at Bohol Diagnostics."_
- _"Any results for me to review?"_
- _"Explain Maria's results and suggest next steps."_
- _"Refer her to Dr. Cruz, internal medicine."_
- _"Which of my patients are overdue?"_
- _"Show Maria's timeline."_

**The patient chart is the hub.** `/patients/:id` shows the patient, their encounters and, beside them, **one Wise
chat per clinician per patient** (`Chat.patientId`, `surface = 'patient'`, kept out of the general chat list). Wise
is told about the patient on every message (demographics, identifiers, consent, the latest encounters, read as the
clinician so row-level security applies, inside a `patient_record` data block), so the clinician never has to say who
the patient is. Encounters are drafted from that chat (`propose_encounter`) and keep a link to it. Memories are never
extracted from a chart chat, so patient details don't leak into other chats. A chart chat is private to its author;
the care team shares the chart, not the conversation. General chats (no patient) stay for questions across patients.

### 9.1 Rule: AI drafts, the doctor confirms

Uses the proposal pattern (`propose-sql`: shows a card, then stops and waits). Every change to a record —
creating, editing or voiding it — is a **proposal card** with Confirm / Edit / Cancel. Only the confirm button calls the
real GraphQL mutation, as the user (RLS and authorization apply). The agent never saves anything, sends orders,
referrals or patient messages, or closes a case by itself, and never says something is saved before the clinician
confirms it (system prompt rule; every propose tool tells the model "Nothing is saved yet").

How it is enforced:

- **Tools can't write.** Every agent tool declares a kind in its definition (`createTool({ kind })`, or `withToolKind`
  for provider tools): `read`, `navigate`, `display` or `propose`. `getTools` refuses a tool without one. Tools reach
  services only through the tool context's frozen read-only facades (`agent/services/tool-services.ts`, an allowlist
  of read methods), never the services themselves, and an ESLint rule keeps services, repositories and Prisma out of
  `agent/tools/`. `tools/registry.spec.ts` checks every kind, the allowlist, and runs each propose tool against
  services that throw on anything else. Memory extraction is the one background write: the model can't call it, it
  isn't clinical, and it is off in chart chats.
- **One card shell, three modes** (`tool-calls/proposal-card/`): `create` shows the draft; `update` names the record
  (patient, date, facility) and shows a before → after of each changed field, unchanged fields folded away, and can't
  be confirmed when nothing changes; `destructive` (void, remove) needs a reason and a second click ("Yes, void …").
  `diffFields` builds the changes. A card never confirms by itself, drops a second Confirm while the first runs, and
  settles once this tab confirmed it, once the clinician answered in the chat, or once the API has its outcome.
- **The API settles each card once.** Confirm sends `wiseOrigin { chatId, toolCallId, toolName, edited }` with the
  normal mutation. `WiseProposalService` checks the tool call is in the user's own chat, made by a tool that may confirm
  that mutation, about the same patient, and not settled; then, in the mutation's transaction, writes
  `wise_proposal_outcome` (unique per tool call, append-only, RLS: own rows) and the audit row with
  `audit_log.origin = { via: 'wise', toolName, chatId, messageId, toolCallId, edited }`. A second Confirm (reload,
  second tab) or a Confirm after Cancel (`cancelWiseProposal`) is refused with CONFLICT. `wiseProposalOutcomes(chatId)`
  lets a reopened chat show its cards settled.
- **No stale overwrite.** An update card carries the record's version (`encounter.version`, bumped by a trigger on
  every update). The mutation takes `expectedVersion` and updates only if the version is unchanged (one statement);
  otherwise CONFLICT "This note was changed after this edit was drafted", and the card offers **Re-draft**.

### 9.2 Agent tools

| Read tools (scoped to the doctor)         | Proposal tools (render a card, no side effects)                         |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `find_patient` (built)                    | `propose_patient_registration` (built)                                  |
| `explain_result` (built; the rule's why)  | `propose_encounter` (built; chart chats)                                |
|                                           | `propose_encounter_note` (built; update card)                           |
| `get_patient_timeline`                    | `propose_order` (built, §9.4)                                           |
| `list_results_to_review` (built, §9.4)    | `propose_result_review` (built, §9.4)                                   |
| `propose_diagnosis`                       | `addDiagnosis` or `updateDiagnosis`                                     | create; changes the visit's diagnosis of that code   |
| `propose_void_diagnosis`                  | `voidDiagnosis`                                                         | destructive / reason                                 |
| `propose_void_vitals`                     | `voidVitals`                                                            | destructive / reason; the card picks the set         |
| `propose_cancel_order`                    | `cancelOrder`                                                           | destructive / reason (the ordering doctor)           |
| `list_lab_orders`                         | (read) `OrderService.labOrdersForWise`                                  | the lab's worklist, STAT first; general chat         |
| `propose_lab_order_step`                  | `acceptOrder` / `markOrderCollected` / `rejectOrder`                    | lab staff, general chat; reject is destructive       |
| `propose_issue_document`                  | `issuePrescription` / `issueMedicalCertificate`                         | strong (signs with the PRC license)                  |
| `propose_void_document`                   | `voidPrescription` / `voidMedicalCertificate`                           | destructive / reason                                 |
| `propose_bill_step`                       | `finalizeEncounterBill` / `markEncounterBillPaid` / `voidEncounterBill` | finalize strong; pay needs the OR no.; void a reason |
| `propose_save_report`                     | `saveReportToChart`                                                     | create; the card finds the version in the chat       |
| `propose_patient_update`                  | `updatePatient` (new)                                                   | contact details only; clinic or hospital staff       |
| `list_my_cases` (filters: overdue, state) | `propose_referral`                                                      |
| `get_case`                                | `propose_patient_message`                                               |
| `list_facilities` (labs, specialists)     | `propose_task`                                                          |
| `get_pathway` (guideline for a condition) | `propose_close_case`                                                    |

With the encounter record (built): `propose_encounter` also takes stated vitals and ICD-10 diagnoses;
`propose_encounter_note`, `propose_prescription` (allergy warning), `propose_medical_certificate` and `propose_charges`
name an encounter by the id in the patient record, and Confirm saves a **draft**; issuing a document or finalizing a
bill stays a separate click on the encounter page.

Kinds of the built tools: `find_patient`, `explain_result`, `load_skill`, `web_search`, `web_fetch` read; `open_page` navigates;
`clarification`, `suggest_follow_ups`, `display_chart`, `display_map` display; every `propose_*` (including the
non-clinical `propose_skill`) proposes.

All of them use §9.1: their cards send `wiseOrigin` and settle once. `propose_prescription`,
`propose_medical_certificate` and `propose_charges` are update cards (before → after, labelled "replaces the draft on
this visit") when a draft already exists, and save against its `version` (migration `0014_wise_record_versions` puts
one on prescriptions, certificates and bills); the card loads the record as the clinician, so the "before" is what
they see. The vitals and diagnoses a confirmed `propose_encounter` drafted are saved right after the encounter with
the same `wiseOrigin`: `recordVitals` / `addDiagnosis` accept it only once that card is confirmed into that encounter
(`WiseProposalService.verifyFollowUp`), and their audit rows record it. No tool voids yet; one would use the
`destructive` mode.

`propose_encounter_note` (chart chats) changes the SOAP note of one of the patient's encounters (the latest by
default). The patient record Wise gets lists each recent encounter's id and current note, so it drafts the full new
text of only the fields that change; the tool reads the note as the user (staff at the visit's facility only, audited)
and returns it with its version. The card shows the before → after and saves with `updateEncounterNote`.

Proposal cards share one frontend shell (`tool-calls/proposal-card/`): the draft or the diff, Edit, warnings
(duplicates, allergy, safety), a stale-record notice with Re-draft, Cancel and Confirm, and a one-line resolved state
once the card is settled. `propose_patient_registration`
is the first: it extracts the patient's details from the conversation and the user's facility, runs the duplicate
check, and the card's Confirm calls the same `registerPatient` mutation as the register form, after consent.

Navigation tool: `open_page` (built). Wise never writes a URL: it picks a key of the page registry
`apps/shared/src/app-pages.ts` (key, label, params schema, path), which the API and the frontend both import, so a new
screen (`cases.detail`, `results.inbox`, `referrals.inbox`) needs one line there. The API validates the params, and for
`patients.detail` reads the patient as the user (RLS, audited), so a chart the user can't see is refused; `find_patient`
searches as the user too and audits each patient it returns. To pull up a record Wise calls `find_patient`, asks when
several match, then `open_page` with the returned id. The card links to the page; when the user explicitly asked to
open it (`userAskedToOpen`), the app navigates by itself once, after the reply ends, and only for a reply it watched
stream, so reopening or replaying a chat never navigates. Embedded chats (the chart's Ask Wise panel, the ask bar) never
navigate by themselves: the clinician is working on that page, and a jump would take it away mid-task; the card's link
still opens the page in the main view. A chart opened from a chat shows "Back to chat".

Charts and summary reports (built, `apps/api/src/clinical/insights/`). Wise never writes a query and never supplies a
number: it picks a fixed dataset and the server reads it as the user (RLS) and audits it.

- `chart_patient_trend`: one patient's BP (with the 140/90 lines), weight/BMI, heart rate, capillary glucose, HbA1c
  (6.5%) or FBS (126 mg/dL) over N months; audited `patient.view` with reason `Wise chart <measure>`. The model gets the
  points back to describe the trend.
- `chart_facility_panel`: counts across the user's facility, from the patients they may see: encounters per week,
  diagnoses by ICD-10 chapter, open orders by age, results awaiting review by flag; audited `panel.view`. Counts only.
  Program metrics (§12: time to treatment, referral funnel, equity) stay on the dashboard; when its metrics service
  exists, a chat tool should call it rather than repeat its SQL.
- `create_report`: a patient clinical summary, an encounter summary or a facility panel summary. The server builds the
  data sections and freezes them in the tool output; Wise writes only the narrative, which is refused when it has a
  number the sections lack. Audited `report.generate`. The card's **Download PDF** prints the frozen data on the
  server with headless Chrome (`puppeteer-core`, the existing export path: static HTML, charts as server-drawn SVG from
  the shared `buildChart`), for the chat's owner only, while they still see the patient; audited `report.export`.
  Every page carries the "Synthetic data — prototype" watermark and an AI-draft footer. Viewing and downloading are
  reads: nothing is saved to the chart (saving a report as a chart document is a later `propose_*` card).

Analytics (built, `apps/api/src/clinical/analytics/`, §10.2 for the safety model): `describe_analytics` (the views,
their documented columns, the metrics), `run_analytics_sql` (one validated SELECT run as the user; the model gets 50
rows, the card the table up to 5,000 rows with View query) and `get_metric` (certified metrics, §12). All `read`.
Both draw a chart when asked, of any Recharts type (`@loopwise/shared/analytics-chart`): grouped, stacked and 100% bars
(vertical and horizontal), line, area, stacked and 100% areas, composed bar + line on two axes, scatter, bubble, pie,
donut, radar, radial bar, treemap, funnel and Sankey. One shared validator checks every column a chart names is in the
result and its value columns numeric (the server refuses, the card offers only the types that fit, as a chart-type
menu); one shared builder draws it in the chat, the report panel, saved documents and the PDF. Thresholds are asked
for by key, never as numbers: the server resolves a pathway's LOINC code to its bands (lines where bands start,
shaded actionable and critical ranges) or "bp" to 140/90. Metrics carry a default chart; `screening_funnel` counts
orders ordered → resulted → reviewed → actioned. `chart_facility_panel` left the model's
toolset for the metrics (one definition per number); its card still renders old chats.

Explaining a result (built, `apps/api/src/agent/tools/explain-result.ts`): `explain_result(resultId)` (kind `read`)
returns the rules engine's evaluation of a result, the stored one or, if none is stored yet, one computed by the same
engine, read as the user (RLS) and audited as `result_evaluation.view`. The chart record lists each recent result's id
(`[result <id>]`) for it. Wise quotes the reason and the guideline; it never classifies a result itself (rules-first,
§2), and the system prompt says so. The card shows the `ResultEvaluationBadge` and links to `/pathways`.

Reports in a side panel (built, Stories ported: `apps/api/src/agent/tools/report.ts`,
`apps/api/src/clinical/reports/`, `apps/frontend/src/feature/reports/`). The `report` tool (kind `display`; create,
search/replace update, replace, restore) writes markdown with blocks that embed tool results of the same chat by
their result id: `<chart ref/>` (a patient trend or an analytics result with a chart), `<table ref/>` (an analytics
result), `<sections ref/>` (a `create_report` summary's data). The tool checks every block against the chat (this
run's outputs, then stored ones, owner-only) and refuses prose with a number no embedded result holds. Each call is a
new version, kept as the tool's output in the chat (no table). The report opens in the chat page's resizable side
panel (an overlay on the patient chart and the Wise dock) with a version menu, Print and PDF (headless Chrome,
`exportWiseReportPdf`, audited `report.export`); the chat shows a "Report: … · vN · Open" chip. For a report about
one patient, **Save to chart** in the panel (the clinician's own action, confirmed in place) freezes that version
with the results it embeds into `clinical_document` (migration `0016`: append-only, RLS through the patient, one row
per version, audited `document.create`); the chart lists them under Documents and opens them as saved
(`document.view`).

Plus the general tools: `clarification`, `suggest-follow-ups`, `load-skill` (clinical guidelines as Markdown
skills). `display_chart` and `display_map` plot `execute_sql` results, so they left the model's toolset with the SQL
tools; their cards still render old chats.

### 9.4 Every action from chat, and Wise tool settings

**Wise actions** (built, phases 1 and 2). One definition per action in `@loopwise/shared/wise-actions` (`WISE_ACTIONS`): tool
name, the mutation that confirms it, the record it is about (encounter, patient or result), the card mode (create,
update, destructive), the confirm strength (standard, reason, strong) and a loose input schema for the model.
`createActionTool(def)` (`agent/tools/action-tool.ts`) turns it into a `propose` tool that only checks the chat and
names the record; `propose-action.tsx` renders it on the shared `ProposalCard` (a `strong` confirm asks for a second
click, as a destructive card does). The mutation accepts the card only from the tools the registry names for it
(`wiseActionToolsFor(mutation)`), verified at the record's facility and settled in its own transaction, with the
Wise origin on the audit row. Adding an action: a definition, one `wiseOrigin` on its mutation, the card's body.

| Tool                     | Confirms with                           | Mode / confirm                                   |
| ------------------------ | --------------------------------------- | ------------------------------------------------ |
| `propose_vitals`         | `recordVitals` (a visit that exists)    | create / standard                                |
| `propose_allergy`        | `addAllergy`                            | create / standard                                |
| `propose_remove_allergy` | `voidAllergy` (`VoidAllergyInput`)      | destructive / reason                             |
| `propose_result_review`  | `reviewResult`                          | update / standard; critical: strong + note (API) |
| `propose_order`          | `createEncounterOrders` (new, batch)    | create / standard; the clinician picks the lab   |
| `list_results_to_review` | (read) `ResultsService.toReviewForWise` | the inbox with the latest `result_evaluation`    |

`createEncounterOrders` creates every test of the card in one transaction (each audited and queued for HL7 as
`createEncounterOrder` does) and settles the card once. One action may confirm with several mutations, one per step (`mutations` in the
definition). Mutations with positional arguments take an optional `wiseOrigin` argument; the others take it in their
input (`VoidEntryInput`, `OrderReasonInput`, `UpdateDiagnosisInput`, `MarkBillPaidInput`).
`WiseProposalService.verifyAction` / `settleAction` verify the card at the record's facility and settle it in the
mutation's transaction. `updatePatient` changes contact details only (phone, preferred language, barangay), as the
user, for staff at a clinic or hospital (a lab sees the patients it ran tests for but doesn't keep their record);
names, birth date, sex and identifiers drive the duplicate match and stay with registration. The lab step tools run
in a general chat (`patientChat: false`) and are on by default for labs, imaging centers and hospitals. Never from chat: users, passwords, facility keys, LLM config, and these settings.

**Wise tool settings** (Settings → Wise tools, `apps/api/src/wise-tools/`, migration `0020_wise_tool_settings`).
`@loopwise/shared/wise-tools` catalogues every tool: label, plain-language summary, kind, category, `locked`,
`comingSoon`, and its default per facility type (clinic and hospital: everything; lab, imaging, pharmacy, program: the
reads, reports and analytics, no chart-writing tools). A facility's admin turns tools on or off there; a user can turn
a tool off for themselves, never on past their facility. `wise_tool_setting` stores overrides only (facility rows or a
user's rows); each change is audited (`wise_tool.enable|disable|reset`, no patient). `clarification`, `find_patient`
and `open_page` are locked on. Confirmation is not a setting: nothing turns off the clinician's Confirm.

Enforced on the server: the agent leaves the tools turned off for the user out of the model's tool set on every run
(the AI SDK refuses a call to one), the system prompt lists them under "Turned off in Wise settings" so Wise says so
rather than fail, and `WiseProposalService.verify` refuses to confirm a card whose tool is off at the record's
facility (a card drafted before the toggle; Cancel still works). A user at several facilities is offered a tool on at
any of them. `registry.spec.ts` fails when a tool the model can get is missing from the catalogue.

### 9.3 Clinical system prompt (essentials)

- Never diagnose on its own; always cite the result values and reference ranges used.
- Critical values: tell the doctor to act now; never draft a patient message for them.
- Only use tools; never invent patients, results or facilities.
- Ask when patient identity is ambiguous.

## 10. Access control and data governance

1. **Deny by default.** A doctor sees a patient only with a `CareRelationship` (encounter, order, accepted referral,
   case owner).
2. **Postgres row-level security.** Each request sets the user/org in the session; Postgres filters rows. App bugs
   can't leak other patients.
3. **Agent scoped the same way.** Tools run with the doctor's identity. The generic `execute-sql` / `query-app-db` are
   gone. Wise analytics (migration `0015_analytics`) lets Wise write SQL over curated `analytics` views of the
   doctor's own patients, with four locks Postgres enforces itself: its own login role `loopwise_analyst` (SELECT on
   `analytics.*` and EXECUTE on `analytics.bind` only, a separate connection pool, no role to switch to), views owned
   by `loopwise_analytics_owner` so the base tables' RLS still filters every row, an identity bound per transaction by
   a one-time token the API issues (`app_private`, out of the roles' reach; `set_config('app.user_id')` is ignored for
   the analyst), and a read-only transaction with a 5 s statement timeout and a 5,000-row cap. In front of that, a
   validator using the real Postgres parser (`libpg-query`) accepts one SELECT over the views with allowlisted
   functions and casts. `pg_stat_activity` is revoked from PUBLIC so analyst sessions can't read each other's SQL.
   Program-office users get counts under 5 as "<5". Every query, refused or run, is audited (`analytics.query` /
   `.rejected` / `.failed`, `origin` with the SQL, row count and patient ids). Tests:
   `test/analytics-security.e2e-spec.ts` checks each attack against the validator and Postgres alone.
4. **Tenant isolation.** Labs see only orders sent to them; pharmacies only their prescriptions.
5. **Break-glass.** Access without a relationship requires a reason, is time-limited, logged and flagged.
6. **Audit everything.** Every view and action → `AuditLog` / `CaseEvent`.
7. **Consent.** Captured on first contact; patients can see who accessed their record (Phase 2 UI).
8. **Demo data is synthetic only** (Synthea → HL7). No real patient data.

Responsible AI: rules-first decisions, human confirmation for every clinical action, approved message templates,
fairness check of loop-closure metrics across sex, age group and area.

## 11. Integration

| Direction            | Standard                                                                   | Notes                                             |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Orders → lab/imaging | HL7 v2 ORM^O01 / OML^O21                                                   | Or web screen for facilities without a system     |
| Results → hub        | HL7 v2 ORU^R01 over MLLP                                                   | Lab (LOINC where available) and radiology reports |
| Pharmacy → hub       | HL7 RDS^O13 or simple REST/webhook                                         | Dispense = evidence                               |
| Internal model       | FHIR-shaped (Patient, ServiceRequest, Observation, DiagnosticReport, Task) | Ready for FHIR APIs later                         |
| Patient messaging    | SMS gateway (e.g. Semaphore) / Messenger; simulated in demo                | WhatsApp later                                    |

The edge connector: MLLP listener, ACK handling, local retry queue (SQLite or file), HTTPS push to the hub with a
facility API key.

Built as `apps/connector` (see its README):

- **Inbound.** The LIS gets a commit ACK (AA) as soon as the message is committed to the connector's SQLite queue
  (`node:sqlite`, WAL, `synchronous = FULL`), not after the hub answers. The connector is where messages wait during
  an outage (§6.3), and an LIS should not have to hold or resend because the hub is away. Text with no MSH gets AR;
  a failed queue write gets AE so the LIS resends.
- **To the hub.** `POST /api/hl7/messages` (text/plain, `Authorization: Bearer <facility key>`), in arrival order per
  sender (MSH-3 + MSH-4). Hub AA → delivered (body dropped locally); AE/AR or another 4xx → failed, kept for review,
  never retried; 5xx, 408, 429 or network errors → retried with exponential backoff (1 s doubling to 5 min). The hub
  is idempotent per MSH-10, so a resend after a lost reply is safe. 401/403 halts all hub traffic with an alert while
  the listener keeps queueing.
- **Orders out.** When `LIS_HOST` is set, the connector polls `GET /api/hl7/outbox`, sends each order to the LIS over
  MLLP and posts the LIS ACK to `POST /api/hl7/outbox/:id/ack`. The LIS ACK is stored first, so a lost hub ack is
  re-posted without a second send to the LIS.
- Logs carry control ids and counts, never message bodies; `/health` reports queue depth and the last hub success.

**Ingest contract** (built): `POST /api/hl7/messages` with `Authorization: Bearer <facility key>` (an org admin issues
it with `createFacilityKey`; only its sha256 hash is stored) and a `text/plain` body holding one HL7 v2 message
(segments separated by `\r`, MLLP framing stripped). The answer is 200 with an HL7 ACK (MSH + MSA, ERR on errors):
`AA` stored, `AE` a valid message that could not be stored (e.g. no matching patient), `AR` not a message the hub
takes. AE and AR are final; the connector retries only 5xx. A resend of the same MSH-10 from the same facility gets
the same ACK and stores nothing twice (`hl7_message`, migration `0017_hl7_ingest`). Patients are matched
deterministically: an identifier the sending facility issued, then a PhilHealth number, then the patient of the order
the message answers (placer number = the Loopwise order id); any conflict is an AE left for review. Each stored
result writes an audit row and publishes `result.received`.

**Orders out (built).** An order for a facility with `uses_hl7_connector` is queued as HL7 v2.3.1 ORM^O01 in
`hl7_outbox` in the transaction that sends it (ORC-1 `NW`; `CA` when the doctor cancels). PID-3 carries the patient's
identifier at the target facility first, then the MRN, PhilHealth and the hub id (`LOOPWISE`, type `PI`); ORC-2 and
OBR-2 carry the order id as placer number; OBR-4 the LOINC code (`LN`). The connector pulls
`GET /api/hl7/outbox?limit=20` with its facility key and posts the lab system's ACK to
`POST /api/hl7/outbox/:id/ack` (`AA` → delivered, `AE`/`AR` → failed; a message stays pending until acknowledged).
Status updates from the lab system (ORM/OML, ORC-1 `SC` with ORC-5 `IP`/`CM`) map to accepted/collected
(`OrderService.applyLabStatus`, called by the HL7 ingest). Facilities without a connector use the lab worklist
(`/orders`).

## 12. Metrics (dashboard)

- Time to: notification, acknowledgement, confirmation, consultation, treatment start.
- Referral acceptance, appointment and completion rates.
- Treatment initiation rate.
- Open actionable results by age (unresolved > SLA).
- Drop-off by step and reason.
- Documented closure rate.
- Patient confidence (post-closure question).
- Equity: all of the above by sex, age group, area.

Demo shows **before vs after** on simulated cohorts (baseline: no tracking vs Loopwise).

Certified metrics (`apps/api/src/clinical/analytics/metrics.ts`, built): one fixed SQL definition per headline number
over the analytics views (panel size, patients by age band / sex / barangay, new patients, encounters per period,
top diagnoses, results awaiting review, open orders by age, overdue follow-ups, prescriptions issued, billing
totals). Wise's `get_metric` uses them now; the dashboard and reports should call the same definitions rather than
repeat the SQL.

## 13. Building on the base code

### Keep

- Agent core, LLM providers (OpenAI, Anthropic, Gemini, Mistral, OpenRouter, OpenAI-compatible), streaming, chat UI.
- `clarification`, `suggest-follow-ups`, `load-skill`, skills (clinical guidelines), memory.
- Attachments (upload previous results as PDF), voice transcription (dictation).
- Auth (better-auth), organizations, users, clinics (formerly projects) → tenants/facilities and their branches.
- pg-boss jobs (SLA timers, escalations, scheduled reminders).
- Charts (dashboard, de-identified only).

### Remove

- Warehouse connections, context sync, context explorer, context recommendations.
- Semantic layer, query workbench, saved query tools, `execute-sql`, `query-app-db`, `propose-sql`.
- Sandbox / Python execution.
- Stories (or keep one for the program dashboard).
- MCP embeds, Discord/Slack/Telegram/Teams links, white-label, usage budgets, onboarding agent.

### Add

- `apps/api/src/clinical/` modules: `patients`, `encounters`, `orders`, `results`, `pathways`, `cases`,
  `referrals`, `tasks`, `messaging`, `audit`.
- `apps/api/src/hl7/` ingest + `apps/connector/` (edge connector app).
- Clinical agent tools and system prompt (§9).
- Frontend: proposal cards, results inbox, nurse worklist, referral inbox, case timeline, facility screens,
  dashboard, simulated patient phone.
- RLS policies + migrations.

Follow the module conventions (`CLAUDE.md`): one folder per feature, thin resolvers, logic in services, Prisma
only in repositories, kebab-case files.

## 14. Prototype scope

**In:** one hub, one edge connector, 3 demo facilities (health center + lab, hospital with radiology, pharmacy),
2 pathways (HbA1c/diabetes, mammogram/breast), Wise for doctors, nurse worklist, referral inbox, simulated SMS
phone, dashboard, synthetic data.

**Out (Phase 2):** full chronic-care management, medication adherence, real SMS at scale, FHIR external APIs,
probabilistic patient matching, mobile apps, patient access log UI, Arabic templates review.

### Demo script (~3 min)

1. Doctor dictates an encounter + orders in Wise → confirms the card.
2. Lab receives the order; HL7 ORU result arrives (HbA1c 7.2%).
3. Wise surfaces it in "results to review" → doctor marks actionable.
4. Patient phone (simulated) gets a calm invite → taps _I understand_.
5. Referral to internist → **rejected (full)** → re-routed → accepted.
6. Patient seen → pharmacy dispense → case closes with evidence.
7. Radiology pathway in fast-forward (abnormal mammogram).
8. Dashboard: before/after loop-closure metrics + equity view.

## 15. 18-day plan (3–20 Nov 2026)

| Days  | Dates     | Work                                                                                                                                           |
| ----- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 3 Nov     | Finalise design, team, register on Hack2skill (deadline 10 Nov), repo + domain                                                                 |
| 2–3   | 4–5 Nov   | Fork the base → strip modules; clinical Prisma schema; RLS; seed synthetic data                                                                |
| 4–6   | 6–8 Nov   | Patient registration and the patient chart (encounters, chart chat; done); HL7 ingest + edge connector; orders/results; rules engine; pathways |
| 7–9   | 9–11 Nov  | Case engine (states, owners, SLAs, escalations via pg-boss); referrals; evidence                                                               |
| 10–12 | 12–14 Nov | Wise tools + proposal cards + clinical prompt; results inbox                                                                                   |
| 13–14 | 15–16 Nov | Nurse worklist, referral inbox, case timeline, simulated patient phone, messaging                                                              |
| 15–16 | 17–18 Nov | Dashboard + metrics + equity; radiology pathway; deploy (MicroK8s/ArgoCD)                                                                      |
| 17    | 19 Nov    | Technical docs, assumptions and limitations, demo video                                                                                        |
| 18    | 20 Nov    | Buffer, final test, submit                                                                                                                     |

The encounter record (vitals, ICD-10 diagnoses, orders from the visit, Rx and medical certificate with print views)
was built on 3 Nov, with its billing and Wise cards.
The edge connector (§11, `apps/connector`) was built on 3 Nov against the hub's HL7 contract, tested with a fake hub
and a fake LIS.
HL7 v2 result ingest (facility keys, ORU^R01 parser, deterministic patient matching, `result.received`) and the
results inbox with review (Days 4–6 and the inbox of Days 10–12) were built on 3 Nov too.
The lab side of orders (Days 4–6: order lifecycle, lab worklist, ORM^O01 out through `hl7_outbox`) was built on
3 Nov as well.
The rules engine and pathways (Days 4–6: the versioned rules schema, the pure engine, `result_evaluation`, the
`result.received` subscriber, `/pathways`, `explain_result`) were built on 3 Nov too. Opening and advancing cases from
`result.evaluated`, and the critical-value alert to a clinician, are the case engine's (Days 7–9).
Wise analytics phase 1 (analytics views, analyst role, validator, metrics, §10.2) was built on 3 Nov too; charts
over analytics results and the reports' metrics come next. Wise charts and summary reports with PDF download (§9.2) were also built on 3 Nov; the deploy (Days 15–16) needs
Chromium in the image (`CHROME_PATH`).

## 16. Assumptions and limitations (draft for submission)

- Synthetic data only; clinical thresholds from published guidelines, to be validated by clinicians before a pilot.
- Patient matching is deterministic in the prototype: the facility MRN or the (national) PhilHealth number is an exact
  match and is never registered twice; the same name, birth date and sex is a possible match the clinician confirms.
  A match the clinician cannot see yet is shown masked (initials, birth year, facility) and can be linked, which adds
  a care relationship and an audit row.
- SMS is simulated; real delivery depends on a gateway and local regulation.
- Facilities without HL7 capability use web screens.
- The AI assistant does not make clinical decisions; every action is human-confirmed.
- Not a medical device; not an EMR replacement.

## 17. Open questions

- Team members and roles (clinician advisor?).
- Exact pathways and thresholds — confirm with a doctor.
- Which LLM for the demo (and a local/sovereign option to mention).
- Repo: new repo forked from the base (recommended) vs branch.
- Domain / GitHub org name availability for Loopwise.
