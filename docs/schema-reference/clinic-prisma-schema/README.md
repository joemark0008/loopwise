# Clinic System: Prisma Schema (Philippine Practice)

Prisma 7 multi-file schema for PostgreSQL. 67 models and 52 enums, split by domain under `prisma/schema/`.

## Setup

```bash
npm i -D prisma dotenv && npm i @prisma/client
# .env
DATABASE_URL="postgresql://user:pass@localhost:5432/clinic"

npx prisma migrate dev --name init
npx prisma generate      # client output: src/generated/prisma
```

## Structure: encounter-centric

```
Patient ── master data: addresses, contacts, IDs, allergies, problems, history, consent,
   │                    PhilHealth membership, HMO coverage, documents
   ├── Appointment                 (booked before a visit exists)
   └── Encounter  ◄── the hub; every clinical record requires encounterId
         ├── Invoice (single-visit bill)  /  InvoiceLine.encounterId (consolidated corporate/HMO bill)
         ├── QueueTicket (triage → doctor → cashier), visit-specific PatientConsent
         ├── VitalSigns, EncounterDiagnosis, EncounterProcedure
         ├── Prescription → PrescriptionItem
         ├── DiagnosticOrder → Item → Result → Values
         ├── Immunization, MedicalCertificate, Referral
         ├── PhilHealthClaim, HmoLoa, ProfessionalFee
         └── StockMovement (consumables used)
```

Records that come from a visit don't store `patientId` or `branchId` again. They get both from the encounter, so the values can never disagree. To query by patient, use a relation filter:

```ts
prisma.prescription.findMany({ where: { encounter: { patientId } } })
```

Visits with no consultation still get an encounter: `LAB_ONLY` covers a walk-in lab request from an outside doctor, and baby-book vaccines are logged in the encounter where they were reviewed, with `isHistorical = true`.

## Domains

| File | Covers |
|---|---|
| organization | Org (TIN, VAT/Non-VAT), branches (DOH LTO, PhilHealth accreditation), users, per-branch roles, document numbering |
| reference | PSGC regions → barangays, ICD-10 (WHO), PhilHealth RVS, case rates |
| practitioner | PRC license, PTR, S2, PhilHealth PAN, TIN, schedules, leaves |
| patient | Name with suffix, civil status, PSGC address, SC/PWD/PhilSys/Solo Parent IDs, allergies, problem list, history, DPA consent |
| scheduling | Appointments (walk-in, Messenger, Viber…), daily queue with priority lane (SC/PWD/pregnant) |
| clinical | Encounters (consult, PEME/APE, Konsulta FPE, prenatal…), SOAP, vitals, ICD-10 diagnoses, RVS procedures |
| diagnostics | Lab and imaging catalog, parameters with sex-based ranges, orders, results (LIS/HL7 fields) |
| prescription | Generic name required (RA 6675), S2 dangerous-drug Rx, quantity in words |
| immunization | NIP/EPI flag, lot/expiry, next due date, historical (baby book) entries |
| documents | Med certs with QR verification code, fit-to-work, PEME class, referrals, S3 file keys |
| philhealth | PIN, principal/dependent, UHC member categories, Konsulta/YAKAP enrollment and ATC, eClaims |
| hmo | Providers, card coverage and MBL, LOA/approval codes, SOA transmittals |
| billing | BIR Sales Invoice series (ATP/CAS), VATable/exempt/zero-rated split, SC/PWD 20% plus VAT exemption with ID proof, GCash/Maya/QR Ph, split tender, cashier shifts, doctor PF with EWT |
| inventory | FDA CPR, dangerous-drug and antimicrobial flags, lots with FEFO expiry, signed stock ledger, supplier deliveries |
| audit | RA 10173 access and change log ("who viewed this patient") |

## Notes
- **DB naming:** tables, columns and enum types are snake_case (`encounters.chief_complaint`). The Prisma client stays camelCase.
- **Time:** instants are `timestamptz`, stored in UTC and shown in Asia/Manila time. Birth dates and expiry dates are `date`; clinic hours are `time`.
- **Seed data needed:** PSGC (PSA), ICD-10, RVS, PhilHealth case rates.
- **Check tax rules with your accountant:** VAT treatment (whether medical services are exempt, which maintenance meds are exempt) and EWT rates on professional fees.
- Fields that point to a User (`*ById`) are plain UUIDs with no foreign key. Use `AuditLog` for traceability.
