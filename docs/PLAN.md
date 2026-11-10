# Loopwise — AI-powered clinic system (plan)

> **Run the whole clinic, with an assistant that drafts and a clinician who decides.**

Loopwise becomes the operating system of a Philippine outpatient clinic: front desk, doctor, lab, pharmacy, cashier and
the patient, with **Wise** (the AI assistant) drafting the work at every desk and a person confirming it. Every
visit is an encounter, and everything recorded during it hangs off that encounter.

| Item             | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| Status           | Product with its own timeline (no longer scoped to the Hack2skill challenge)    |
| Primary customer | Private / multi-doctor **outpatient clinics in the Philippines** (1–10 doctors) |
| Later customers  | Clinic chains (multi-branch), diagnostic centers, RHUs                          |
| Base             | Everything on `main` today (see §3); same stack and conventions as `CLAUDE.md`  |
| Design           | `docs/DESIGN.md` (rewritten for the clinic product, 5 Nov 2026)                 |

---

## 1. Problem

A typical Philippine outpatient clinic runs on paper logbooks, a Messenger inbox for bookings, handwritten
prescriptions and a spreadsheet for stocks. The doctor spends a large share of each consult writing; the front desk
juggles walk-ins and appointments by hand; results come back on paper and nobody tracks whether the patient returned;
PhilHealth claims and BIR invoices are re-typed. Most clinic software digitises the forms but leaves the typing to the
staff.

What we sell: **less typing, fewer dropped patients, cleaner records** — every desk gets a Wise draft it can confirm in
one click, and every result reaches the doctor who ordered it.

## 2. Who uses it

| Role                      | Home screen                 | Wise drafts for them                                                                         |
| ------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| Receptionist / front desk | Today: appointments + queue | Bookings from a message, registration from an ID photo, reschedules, reminders               |
| Nurse                     | Queue + triage              | Vitals and chief complaint from dictation, triage level, follow-up calls                     |
| Doctor                    | Today + patient chart       | **AI scribe**: SOAP note, diagnoses, Rx, orders, med cert, patient handout                   |
| Lab / imaging staff       | Order worklist (built)      | Order steps, result review summaries                                                         |
| Pharmacist                | Dispense queue + stock      | Dispense against an Rx, substitutions, reorder list, expiry alerts                           |
| Cashier                   | Billing queue               | Charges from the visit, PhilHealth / HMO split, invoice                                      |
| Clinic owner / admin      | Dashboard + settings        | Daily summary, revenue, no-shows, stock value, Wise tool settings                            |
| Patient                   | Portal (mobile web) + SMS   | Booking, plain-language result explanations, reminders (never clinical advice from AI alone) |

## 3. What we already have (keep)

Built and on `main` (details in `docs/NEXT.md` → Done):

- **Data model:** the PH clinic base schema (DESIGN.md §5): organizations and clinics, practitioners, patients per
  organization, encounter-centric records, diagnostics, prescriptions, documents, PhilHealth, HMO, billing, inventory,
  audit; RLS deny-by-default and append-only audit.
- **Patients:** registration (MRN per organization, data-privacy consent, duplicate checks), chart, allergies, IDs.
- **Encounters:** status and number, SOAP note, vitals with flags, ICD-10 diagnoses, prescriptions (formulary, allergy
  warning, S2), medical certificates (PRC license), referrals, print views.
- **In-house lab:** test catalog, orders, lab worklist (collect, enter results, release), results inbox.
- **Cashier:** invoices with SC/PWD discounts and the VAT split, BIR invoice series, split-tender payments, void.
- **Wise:** ~30 tools behind "AI drafts, the clinician confirms" (proposal cards, version checks, per-organization
  tool settings), navigation, trends, safe analytics SQL with small-cell suppression, reports + PDF,
  voice transcription (`apps/api/src/transcribe/`), skills, memory, multi-provider LLMs.
- **Platform:** better-auth, organizations and clinics with staff roles per clinic, pg-boss jobs (`@Job`), request
  correlation ids, design system, a11y tests.

Removed on 5 Nov 2026: the HL7 interface (labs are in-house) and the follow-up engine (pathways, rules engine, care
cases, case referrals). Follow-ups are now the encounter's follow-up date and disposition plus appointments.

## 4. Product modules

Modules marked **new** don't exist yet. Each follows the module conventions (`apps/api/src/clinical/<feature>/`,
thin resolvers, logic in services, Prisma only in repositories, RLS, audit, Wise tools as drafts).

### 4.1 Staff roles and clinic setup (new — foundation)

- Staff roles per clinic (`user_clinic_roles`, built in Phase 0) drive the desk and the role checks
  (`@ClinicAccess({ staffRoles })`).
- Clinic profile: branches, rooms, clinic hours, services and fee schedule, doctors' schedules and PF (professional
  fee) rules, PhilHealth accreditation numbers, BIR details.
- Role-based navigation and Wise tool defaults per role (extends `@loopwise/shared/wise-tools`).

### 4.2 Appointments and queue (new — must-have)

- Doctor schedules (slots, breaks, leave), appointment types and durations, booking / reschedule / cancel / no-show.
- Walk-in queue per doctor with queue numbers, check-in, status board (waiting → triage → with doctor → billing →
  done), optional TV display page.
- Triage at the nurse station: vitals, chief complaint, priority; feeds the encounter.
- Appointment → encounter on check-in, so the visit, its bill and its follow-ups link back to the booking.
- Wise: "Book Maria with Dr. Reyes next Tuesday morning" → booking card; summarise today's schedule; draft reschedule
  messages when a doctor is out.
- Jobs: reminder 24 h and 2 h before, no-show marking, waitlist fill.

### 4.3 AI scribe (new — must-have, the headline feature)

- Record or dictate during the consult (built: transcription) → Wise drafts **one structured card set**: SOAP note,
  vitals, diagnoses (ICD-10), Rx, lab orders, med cert, follow-up date and a patient-friendly visit summary.
- Each part is its own proposal card, confirmed separately (existing `ProposalCard`, `wiseOrigin`, versioning).
- Taglish / Filipino / Cebuano speech in, English clinical note out; patient summary in the patient's language.
- Consent for recording captured per visit; audio not kept after the transcript is confirmed (configurable).
- Guard rails: allergy and interaction checks on drafted Rx, dose ranges by age/weight, the doctor's signature on
  every issued document.

### 4.4 Pharmacy and inventory (new — must-have)

- Item master (generic, brand, strength, form, unit, price), linked to the formulary used by prescriptions.
- Stock by branch with lots and expiry, receiving (purchase orders / deliveries), adjustments, transfers, FEFO
  dispensing.
- Dispense queue fed by issued prescriptions; partial dispense, substitution (generic equivalence) with the
  pharmacist's confirmation; dispense writes the stock ledger and posts charges to the invoice.
- Supplies used in procedures deducted from stock.
- Alerts (jobs): low stock, near expiry, slow movers. Wise drafts a reorder list from usage.

### 4.5 Follow-ups and results

- The encounter's follow-up date and disposition (built) feed a follow-up list and reminders that book an appointment.
- Referrals from a visit (built in the API) to a colleague or an outside doctor or facility; a referral letter print.
- Critical results always go to a clinician first, never an automated patient message (built).

### 4.6 Patient portal and reminders (new — must-have)

- Mobile web portal (magic link / OTP, no app): upcoming appointments, booking, visit summaries, issued documents,
  released results with a plain-language explanation the doctor approved, invoices.
- Channels: SMS first (provider TBD), then Messenger; message templates per language; opt-out.
- Reminders (jobs): appointment, medication refill, follow-up due, overdue results.
- Inbound questions land in the clinic inbox; Wise drafts a reply, staff send it.

### 4.7 Billing, PhilHealth and HMOs (extend built billing)

- Built: invoices on the reference model, SC/PWD discounts (RA 9994 / RA 10754), BIR invoice series, payments.
- Next: packages, corporate accounts, doctor PF split and EWT (`professional_fees`), cashier shifts and X/Z reading.
- HMO letters of authorization and statements; PhilHealth eClaims / Konsulta later (§6).
- Daily cash-up and end-of-day report.

### 4.8 Clinic dashboard and reports (extend built analytics)

- Owner dashboard: patients seen, revenue, no-show rate, wait time, top diagnoses, stock value, follow-ups due.
- Wise analytics (built) gets these metrics; reports export as PDF (built).
- Morning brief for doctors: today's list, results to review, follow-ups due.

## 5. AI principles (unchanged, now applied to every desk)

1. **Wise drafts, a person confirms.** Agent tools read (scoped to the user under RLS) or render proposal cards; only
   the confirm button calls the mutation. Applies to bookings, dispensing and billing as much as to orders.
2. **Clinical safety first.** Critical values never get an automated patient message; patient-facing explanations are
   approved by a clinician before release.
3. **Everything is audited.** Every view and action writes `AuditLog`; Wise-originated changes carry their origin.
4. **Turnable off.** Clinic admins choose which Wise tools each role has (built).
5. **Data stays in scope.** Data Privacy Act (RA 10173): consent, purpose limitation, NPC registration, breach
   process, and a choice of LLM provider (incl. a local / self-hosted option) per clinic.

## 6. Phases

Estimates assume the current pace (one coordinator + feature worktrees). They are sizes, not dates.

| Phase                        | Size     | Scope                                                                                                                     | Done when                                                                       |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **0. Realign**               | ~1 week  | Rewrite `DESIGN.md` and `CLAUDE.md` intro for the clinic product; update `NEXT.md`; cleanup list (§7); staff roles (§4.1) | Docs agree; every user has a real role; dead base code gone                     |
| **1. Front desk + scribe**   | ~3 weeks | Clinic setup, appointments and queue, triage, AI scribe card set                                                          | A walk-in and a booked patient go reception → nurse → doctor → bill in Loopwise |
| **2. Pharmacy + follow-ups** | ~3 weeks | Item master, stock, dispense queue, alerts; follow-up list and reminders                                                  | An Rx is dispensed from stock; a follow-up date becomes a booked appointment    |
| **3. Patients**              | ~2 weeks | Portal, SMS reminders, inbox with Wise reply drafts, approved result explanations                                         | A patient books, gets reminded and reads their visit summary on a phone         |
| **4. Pilot readiness**       | ~3 weeks | Billing extensions, BIR invoices, HMO, owner dashboard, DPA compliance pack, backups, deploy, onboarding/import tools     | One real clinic runs a week on Loopwise with synthetic-to-real data migration   |
| **5. Growth**                | ongoing  | More clinic locations per install, PhilHealth eClaims / Konsulta, Messenger, telemedicine, FHIR API                       | A business runs two or more clinic locations on one install                     |

## 7. Cleanup carried over (Phase 0)

Done on 5 Nov 2026 (details in `docs/NEXT.md` → Cleanup): edge connector deleted; 83 unreachable base-app files and
their tests removed; 14 unused tables dropped (`0021_drop_unused_base_tables`); automations and `recentFeedbacks`
removed from the API; Borna fonts and the route-baseline recorder deleted; `e2e/flows.spec.ts` green; docs rewritten.

Still to do:

- Dormant base code inside live modules: stories, MCP stand-ins, citations, chat query rows / query grouping in
  `lib/ai.ts`, subagent flags, user groups and clinic saved prompts (each threaded through the agent core; one
  focused session each).
- Encounter note form doesn't send `expectedVersion`; ICD-10 search as a combobox.
- Break-glass access (§8.5 of DESIGN.md) — still needed for a multi-doctor clinic.
- Phase 0 schema adoption: done (see `docs/NEXT.md`); the dev database is reset and reseeded at merge.

Dropped from the old plan: Hack2skill registration and submission, the 3-facility Bohol demo story, the equity
dashboard as a headline, MicroK8s/ArgoCD as a requirement for the first pilot.

## 8. Open questions

- Product name: keep **Loopwise**, or rename for the clinic market?
- SMS provider (Semaphore, Twilio, M360 …) and whether Messenger is in Phase 3 or 5.
- LLM hosting for patient data: cloud provider with a DPA, or a local model option from day one?
- Speech-to-text quality for Taglish / Cebuano — which provider, and do we need a local fallback?
- Pilot clinic: which one, which specialties, how many doctors?
- When does a clinic with its own LIS need an interface again (HL7 or FHIR)?

## 9. Docs

Updated for the clinic product on 5 Nov 2026: `docs/DESIGN.md` (technical design; API structure in §4.5, data model
in §5, follow-ups in §6, metrics in §10), `CLAUDE.md` (product description and clinical feature list), `docs/NEXT.md` (handoff with
Phase 0–1), `README.md`. Keep them in step as each phase lands.
