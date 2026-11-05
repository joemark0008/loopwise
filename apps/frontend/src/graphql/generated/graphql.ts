/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AddAllergyInput = {
  /** e.g. "Penicillin", "Shrimp". */
  allergen: string;
  patientId: string | number;
  reaction?: string | null | undefined;
  severity?: Severity | null | undefined;
  /** Default DRUG. */
  type?: AllergyType | null | undefined;
  /** Set by a Wise card (`propose_allergy`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type AddDiagnosisInput = {
  /** The diagnosis as printed, normally the ICD-10 title. */
  description: string;
  encounterId: string | number;
  /** ICD-10 code of `icd10_codes`, e.g. `I10` or `E11.9`. */
  icd10Code: string;
  /** Default true; false for a provisional diagnosis. */
  isFinal?: boolean | null | undefined;
  notes?: string | null | undefined;
  /** Default: PRIMARY for the first diagnosis, else SECONDARY. A new PRIMARY demotes the previous one. */
  type?: DiagnosisType | null | undefined;
  /** Set when completing a confirmed `propose_encounter` card (its drafted vitals and diagnoses). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type AllergyType =
  | 'DRUG'
  | 'ENVIRONMENTAL'
  | 'FOOD'
  | 'OTHER';

/** A doctor's slots at a clinic on a day. */
export type AppointmentSlotsInput = {
  clinicId: string | number;
  /** YYYY-MM-DD (Manila). */
  date: string;
  practitionerId: string | number;
};

/** SCHEDULED → CONFIRMED → ARRIVED (checked in) → IN_PROGRESS (with the doctor) → COMPLETED; or CANCELLED, NO_SHOW, RESCHEDULED (a new appointment points back at it). */
export type AppointmentStatus =
  | 'ARRIVED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'SCHEDULED';

export type BookAppointmentInput = {
  /** How the patient booked; default PHONE. */
  channel?: BookingChannel | null | undefined;
  clinicId: string | number;
  notes?: string | null | undefined;
  patientId: string | number;
  practitionerId: string | number;
  reason?: string | null | undefined;
  /** ISO 8601: the start of one of the doctor's open slots (`appointmentSlots`). */
  scheduledStart: string;
  /** Default NEW_PATIENT. */
  visitType?: VisitType | null | undefined;
  /** Set by the Wise card (`propose_appointment`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type BookingChannel =
  | 'FACEBOOK_MESSENGER'
  | 'ONLINE_PORTAL'
  | 'PHONE'
  | 'REFERRAL'
  | 'SMS'
  | 'VIBER'
  | 'WALK_IN';

/** Calls the next patient at a station: the priority lane first, then by arrival. */
export type CallNextInput = {
  clinicId: string | number;
  /** DOCTOR: the doctor's line; default your own. */
  practitionerId?: string | number | null | undefined;
  station: QueueStation;
};

export type CancelAppointmentInput = {
  appointmentId: string | number;
  /** Why the booking is cancelled. */
  reason: string;
};

/** Cancelling one test of an order (or every test still open), with the reason. */
export type CancelDiagnosticOrderInput = {
  /** One test of the order; without it, every test still open. */
  itemId?: string | number | null | undefined;
  orderId: string | number;
  /** Why, as the doctor or the lab sees it. */
  reason: string;
  /** Set by a Wise card (`propose_cancel_order`, `propose_lab_order_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type CancelQueueTicketInput = {
  /** Why (e.g. left before being seen). */
  reason: string;
  ticketId: string | number;
};

export type CertificateType =
  | 'APE_CERTIFICATE'
  | 'DRIVERS_LICENSE_MEDICAL'
  | 'FIT_TO_WORK'
  | 'MEDICAL_CERTIFICATE'
  | 'MEDICAL_CLEARANCE'
  | 'PEME_CERTIFICATE'
  | 'SSS_SICKNESS'
  | 'VACCINATION_CERTIFICATE';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChatContextUsageInput = {
  chatId: string | number;
  model?: ModelSelectionInput | null | undefined;
};

export type ChatListInput = {
  /** all, mine, starred, shared, shared_with_me. */
  filters?: Array<string>;
  /** star, date, clinic, ownership, sourcePlatform or none. */
  groupBy?: string;
};

/** Checks a patient in: today's booking (`appointmentId`), or a walk-in (`patientId` and the doctor whose line they join). Opens the visit and issues the queue number in one transaction. */
export type CheckInPatientInput = {
  /** Today's booking. */
  appointmentId?: string | number | null | undefined;
  clinicId: string | number;
  /** A walk-in: the patient (registered first). */
  patientId?: string | number | null | undefined;
  /** A walk-in: the doctor whose line they join. */
  practitionerId?: string | number | null | undefined;
  /** The priority lane "P" (senior, PWD, pregnant, with an infant, emergency); else lane "A". */
  priorityReason?: PriorityReason | null | undefined;
  /** Why they came (the starting chief complaint). */
  reason?: string | null | undefined;
  /** TRIAGE (default) or straight to the DOCTOR. */
  station?: QueueStation | null | undefined;
  /** A walk-in: default NEW_PATIENT. */
  visitType?: VisitType | null | undefined;
};

/** A clinic's appointments over one or more days (the day and week views). */
export type ClinicAppointmentsInput = {
  clinicId: string | number;
  /** How many days, 1 (default) to 7 (a week). */
  days?: number | null | undefined;
  /** The first day, YYYY-MM-DD (Manila). */
  from: string;
  /** One doctor's appointments. */
  practitionerId?: string | number | null | undefined;
  /** Default: every status. */
  statuses?: Array<AppointmentStatus> | null | undefined;
};

export type ClinicEncountersInput = {
  clinicId: string | number;
  /** Visits started on or after this ISO 8601 time. */
  startedFrom?: string | null | undefined;
  /** Default: every status but CANCELLED. */
  statuses?: Array<EncounterStatus> | null | undefined;
};

export type CompleteSetupInput = {
  email: string;
  name: string;
  password: string;
  token: string;
};

export type CreateClinicInput = {
  name: string;
};

/** A lab or imaging request for a visit: one order, one item per test of the clinic's catalog. */
export type CreateDiagnosticOrderInput = {
  /** The indication printed on the request. */
  clinicalInfo?: string | null | undefined;
  encounterId: string | number;
  /** The outside doctor of a walk-in lab request, when the user isn't a practitioner. */
  externalPhysician?: string | null | undefined;
  /** To be done outside the clinic (the request is printed). */
  isExternal?: boolean | null | undefined;
  /** Default ROUTINE. */
  priority?: OrderPriority | null | undefined;
  /** Tests of the organization's catalog (`diagnosticTests`). */
  testIds: Array<string | number>;
  /** Set by a Wise card (`propose_order`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type CreateEncounterInput = {
  /** The clinic of the visit (`myCareClinics`). */
  clinicId: string | number;
  notes?: string | null | undefined;
  patientId: string | number;
  /** The chief complaint. */
  reason: string;
  /** The patient's chart chat, when Wise drafted the encounter. */
  sourceChatId?: string | number | null | undefined;
  /** ISO 8601; now when left out. */
  startedAt?: string | null | undefined;
  /** OPEN (checked in) or IN_PROGRESS (with the doctor). Default: IN_PROGRESS for a practitioner. */
  status?: EncounterStatus | null | undefined;
  /** Default CONSULTATION. */
  type?: EncounterType | null | undefined;
  /** Set by the Wise card (`propose_encounter`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type CreateSharedChatInput = {
  allowedUserIds?: Array<string> | null | undefined;
  chatId: string | number;
  /** Also notify recipients outside the app (Phase 5 notifications). */
  notify?: boolean;
  /** clinic or specific. */
  visibility?: string;
};

export type CreateSkillInput = {
  body: string;
  description: string;
  name: string;
};

export type CreateUserInput = {
  email: string;
  name: string;
  /** Organization access level: admin, user or viewer (OrgRole ADMIN / MEMBER / VIEWER). */
  role: string;
  /** Roles at the selected clinic, e.g. NURSE. */
  staffRoles?: Array<StaffRole> | null | undefined;
};

export type DeleteSkillInput = {
  expectedHash: string;
  name: string;
};

export type DiagnosisType =
  | 'COMORBIDITY'
  | 'PRIMARY'
  | 'SECONDARY'
  | 'WORKING';

/** Laboratory, imaging, cardio (ECG, 2D echo) or other. */
export type DiagnosticCategory =
  | 'CARDIO'
  | 'IMAGING'
  | 'LABORATORY'
  | 'OTHER';

/** A lab step on one test (start the run, release the result). */
export type DiagnosticItemStepInput = {
  itemId: string | number;
  /** Set by a Wise card (`propose_lab_order_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** REQUESTED → (PAID) → SPECIMEN_COLLECTED → IN_PROGRESS → RESULTED → RELEASED, or CANCELLED before the result; a result that needs correcting goes back to IN_PROGRESS. */
export type DiagnosticOrderStatus =
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'PAID'
  | 'RELEASED'
  | 'REQUESTED'
  | 'RESULTED'
  | 'SPECIMEN_COLLECTED';

/** One analyte of a result as the medtech enters it. */
export type DiagnosticResultValueInput = {
  /** The lab calls the value in as critical (only outside its reference range). */
  critical?: boolean | null | undefined;
  /** The name of a free analyte (no parameter). */
  name?: string | null | undefined;
  /** One of the test's parameters; leave out for a free analyte. */
  parameterId?: string | number | null | undefined;
  /** Unit of a free analyte; a parameter uses its own. */
  unit?: string | null | undefined;
  /** As read; blank values are skipped. */
  value: string;
};

/** SENIOR_CITIZEN (RA 9994) and PWD (RA 10754): 20% plus VAT exemption. */
export type DiscountType =
  | 'EMPLOYEE'
  | 'NATIONAL_ATHLETE'
  | 'PROMO'
  | 'PWD'
  | 'SENIOR_CITIZEN'
  | 'SOLO_PARENT'
  | 'SPECIAL';

export type Disposition =
  | 'ADMITTED'
  | 'EXPIRED'
  | 'FOR_FOLLOW_UP'
  | 'REFERRED'
  | 'SENT_HOME'
  | 'TRANSFERRED_ER';

/** DRAFT (editable) or ISSUED (signed and locked; it can then only be voided). */
export type DocumentStatus =
  | 'DRAFT'
  | 'ISSUED';

export type DuplicateMatch =
  | 'EXACT_IDENTIFIER'
  | 'NAME_BIRTH_SEX';

export type EditMemoryInput = {
  content: string;
  memoryId: string | number;
};

/** OPEN (checked in, triage) → IN_PROGRESS (with the doctor) → FOR_BILLING → COMPLETED; or CANCELLED. */
export type EncounterStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FOR_BILLING'
  | 'IN_PROGRESS'
  | 'OPEN';

export type EncounterType =
  | 'APE'
  | 'CONSULTATION'
  | 'DENTAL'
  | 'EMERGENCY'
  | 'FOLLOW_UP'
  | 'IMMUNIZATION'
  | 'KONSULTA_FPE'
  | 'KONSULTA_VISIT'
  | 'LAB_ONLY'
  | 'PEME'
  | 'PRENATAL'
  | 'PROCEDURE'
  | 'TELECONSULTATION'
  | 'WELL_BABY';

/** The result of one test: analyte values (laboratory) or findings and impression (imaging). Entering it again before release replaces it; after release it is a correction that needs releasing again. */
export type EnterDiagnosticResultInput = {
  findings?: string | null | undefined;
  impression?: string | null | undefined;
  itemId: string | number;
  /** For a correction: what changed and why. */
  remarks?: string | null | undefined;
  values?: Array<DiagnosticResultValueInput>;
};

export type ForkSharedChatInput = {
  selection?: SelectionInput | null | undefined;
  shareId: string | number;
};

export type IdentificationType =
  | 'BARANGAY_ID'
  | 'COMPANY_ID'
  | 'DRIVERS_LICENSE'
  | 'GSIS'
  | 'OTHER'
  | 'PASSPORT'
  | 'PHILHEALTH_ID'
  | 'PHILSYS_NATIONAL_ID'
  | 'POSTAL_ID'
  | 'PRC_ID'
  | 'PWD'
  | 'SENIOR_CITIZEN_OSCA'
  | 'SOLO_PARENT'
  | 'SSS'
  | 'STUDENT_ID'
  | 'TIN'
  | 'UMID'
  | 'VOTERS_ID';

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  /** The catalog item; else matched by name, else a free line. */
  serviceItemId?: string | number | null | undefined;
  /** Ignored for catalog items (the item's applies). */
  taxType?: TaxType | null | undefined;
  /** Pesos, VAT included for VATABLE items. */
  unitPrice: number;
};

/** DRAFT (editable), ISSUED (numbered and locked), PARTIALLY_PAID, PAID, VOID. */
export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'VOID';

export type IssueInvoiceInput = {
  expectedVersion?: number | null | undefined;
  id: string | number;
  /** Set by a Wise card (`propose_bill_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** Use an existing patient that `checkPatientDuplicates` matched, instead of a new one. */
export type LinkExistingPatientInput = {
  /** House no., street, purok / sitio. */
  addressLine?: string | null | undefined;
  /** PSGC code of the barangay of residence (`barangays`). */
  barangayCode?: string | null | undefined;
  /** YYYY-MM-DD. */
  birthDate: string;
  /** The clinic registering the patient (`myCareClinics`); its organization owns them. */
  clinicId: string | number;
  consentGiven: boolean;
  /** Last name. */
  familyName: string;
  /** First name. */
  givenName: string;
  middleName?: string | null | undefined;
  patientId: string | number;
  /** An existing chart number to keep; left out, the clinic's next patient number is assigned. */
  patientNo?: string | null | undefined;
  philHealthId?: string | null | undefined;
  phone?: string | null | undefined;
  preferredLanguage?: string | null | undefined;
  sex: Sex;
  /** Set by the Wise card (`propose_patient_registration`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type ManagedUserStatus =
  | 'ACTIVE'
  | 'DEACTIVATED'
  | 'INVITED';

/** The specimen of a test was taken. */
export type MarkSpecimenCollectedInput = {
  /** The specimen label (barcode); default the order number and the test code. */
  accessionNo?: string | null | undefined;
  itemId: string | number;
  /** Set by a Wise card (`propose_lab_order_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type MessageFeedbackInput = {
  chatId: string | number;
  explanation?: string | null | undefined;
  messageId: string | number;
  /** up or down. */
  vote: string;
};

export type ModelSelectionInput = {
  modelId: string;
  provider: string;
};

export type ModifyPasswordInput = {
  confirmPassword: string;
  newPassword: string;
};

export type OrderPriority =
  | 'ROUTINE'
  | 'STAT'
  | 'URGENT';

export type PatientDraftInput = {
  /** House no., street, purok / sitio. */
  addressLine?: string | null | undefined;
  /** PSGC code of the barangay of residence (`barangays`). */
  barangayCode?: string | null | undefined;
  /** YYYY-MM-DD. */
  birthDate: string;
  /** The clinic registering the patient (`myCareClinics`); its organization owns them. */
  clinicId: string | number;
  /** Last name. */
  familyName: string;
  /** First name. */
  givenName: string;
  middleName?: string | null | undefined;
  /** An existing chart number to keep; left out, the clinic's next patient number is assigned. */
  patientNo?: string | null | undefined;
  philHealthId?: string | null | undefined;
  phone?: string | null | undefined;
  preferredLanguage?: string | null | undefined;
  sex: Sex;
};

export type PaymentMethod =
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CHECK'
  | 'CORPORATE_CHARGE'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'GCASH'
  | 'HMO'
  | 'MAYA'
  | 'OTHER'
  | 'PHILHEALTH'
  | 'QR_PH';

export type PaymentStatus =
  | 'POSTED'
  | 'REFUNDED'
  | 'VOIDED';

export type PractitionerType =
  | 'DENTIST'
  | 'MIDWIFE'
  | 'NURSE'
  | 'NUTRITIONIST_DIETITIAN'
  | 'OPTOMETRIST'
  | 'OTHER'
  | 'PHYSICAL_THERAPIST'
  | 'PHYSICIAN'
  | 'PSYCHOLOGIST';

export type PrescriptionItemInput = {
  brandName?: string | null | undefined;
  dosageForm?: string | null | undefined;
  /** Per intake, e.g. "1 tablet"; writes the sig when none. */
  dose?: string | null | undefined;
  durationDays?: number | null | undefined;
  frequency?: string | null | undefined;
  /** Generic name (required, RA 6675). */
  genericName: string;
  /** As needed (PRN). */
  isPrn?: boolean | null | undefined;
  quantity: number;
  /** Required for dangerous drugs (RA 9165). */
  quantityInWords?: string | null | undefined;
  /** PO (default), SL, TOP, INH, NAS, OPH, OTIC, PR, PV, IM, IV, SC. */
  route?: string | null | undefined;
  /** The directions as printed. */
  sig?: string | null | undefined;
  strength?: string | null | undefined;
  unit?: string | null | undefined;
};

/** Dispensing state: ACTIVE → PARTIALLY_DISPENSED → DISPENSED; CANCELLED when voided; EXPIRED. */
export type PrescriptionStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'DISPENSED'
  | 'EXPIRED'
  | 'PARTIALLY_DISPENSED';

/** The priority lane (RA 9994 seniors, RA 7277 / RA 10754 PWDs, pregnant, with an infant, emergency). */
export type PriorityReason =
  | 'EMERGENCY'
  | 'PREGNANT'
  | 'PWD'
  | 'SENIOR_CITIZEN'
  | 'WITH_INFANT';

export type QueryRowsInput = {
  chatId: string | number;
  /** Every row from `offset` when omitted. */
  limit?: number | null | undefined;
  offset?: number;
  queryId: string;
  sort?: QuerySortInput | null | undefined;
  toolCallId: string;
};

export type QuerySortInput = {
  column: string;
  /** asc or desc. */
  direction: string;
};

export type QueueStation =
  | 'CASHIER'
  | 'DOCTOR'
  | 'TRIAGE';

/** WAITING → CALLED → SERVING → DONE; or SKIPPED (not there when called), CANCELLED. */
export type QueueStatus =
  | 'CALLED'
  | 'CANCELLED'
  | 'DONE'
  | 'SERVING'
  | 'SKIPPED'
  | 'WAITING';

/** A clinic's queue on a day: every line, one station, or one doctor's line. */
export type QueueTicketsInput = {
  clinicId: string | number;
  /** YYYY-MM-DD (Manila); default today. */
  date?: string | null | undefined;
  /** Your own line as a doctor (the doctor's room, your practitioner). */
  mine?: boolean | null | undefined;
  /** One doctor's line. */
  practitionerId?: string | number | null | undefined;
  station?: QueueStation | null | undefined;
  /** Default: every status. */
  statuses?: Array<QueueStatus> | null | undefined;
};

export type RecordPaymentInput = {
  /** Pesos applied to the invoice; at most its balance. */
  amount: number;
  /** The invoice's `version` the card showed. */
  expectedVersion?: number | null | undefined;
  invoiceId: string | number;
  /** PHILHEALTH records a package (e.g. Konsulta) PhilHealth pays. */
  method: PaymentMethod;
  notes?: string | null | undefined;
  /** Official receipt number, e-wallet / card reference, or the PhilHealth package code. */
  referenceNo: string;
  /** Cash handed over; the change is computed. */
  tenderedAmount?: number | null | undefined;
  /** Set by a Wise card (`propose_bill_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type RecordVitalsInput = {
  bloodGlucoseMgDl?: number | null | undefined;
  diastolicMmHg?: number | null | undefined;
  encounterId: string | number;
  heartRateBpm?: number | null | undefined;
  heightCm?: number | null | undefined;
  painScore?: number | null | undefined;
  respiratoryRate?: number | null | undefined;
  spo2Pct?: number | null | undefined;
  systolicMmHg?: number | null | undefined;
  temperatureC?: number | null | undefined;
  weightKg?: number | null | undefined;
  /** Set when completing a confirmed `propose_encounter` card (its drafted vitals and diagnoses). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** SENT → ACCEPTED → COMPLETED, or DECLINED / CANCELLED (DRAFT unused for now). */
export type ReferralStatus =
  | 'ACCEPTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'DRAFT'
  | 'SENT';

export type RegisterPatientInput = {
  /** Register although a patient with the same name, birth date and sex exists (never for an identifier match). */
  acknowledgeDuplicates?: boolean;
  /** House no., street, purok / sitio. */
  addressLine?: string | null | undefined;
  /** PSGC code of the barangay of residence (`barangays`). */
  barangayCode?: string | null | undefined;
  /** YYYY-MM-DD. */
  birthDate: string;
  /** The clinic registering the patient (`myCareClinics`); its organization owns them. */
  clinicId: string | number;
  /** The patient agreed to the data-privacy notice (RA 10173); recorded as a consent. Required. */
  consentGiven: boolean;
  /** Last name. */
  familyName: string;
  /** First name. */
  givenName: string;
  middleName?: string | null | undefined;
  /** An existing chart number to keep; left out, the clinic's next patient number is assigned. */
  patientNo?: string | null | undefined;
  philHealthId?: string | null | undefined;
  phone?: string | null | undefined;
  preferredLanguage?: string | null | undefined;
  sex: Sex;
  /** Set by the Wise card (`propose_patient_registration`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type RenameChatInput = {
  chatId: string | number;
  title: string;
};

export type RenameClinicInput = {
  clinicId: string | number;
  name: string;
};

/** Moves a booking to another slot: the old one becomes RESCHEDULED, a new one points at it. */
export type RescheduleAppointmentInput = {
  appointmentId: string | number;
  /** Another doctor; default the same. */
  practitionerId?: string | number | null | undefined;
  /** Why (e.g. the doctor is out). */
  reason?: string | null | undefined;
  /** ISO 8601: the new slot. */
  scheduledStart: string;
  /** Set by the Wise card (`propose_reschedule`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** A value against the test's reference range. */
export type ResultFlag =
  | 'ABNORMAL'
  | 'CRITICAL_HIGH'
  | 'CRITICAL_LOW'
  | 'HIGH'
  | 'LOW'
  | 'NORMAL';

export type ResultUrgency =
  | 'ABNORMAL'
  | 'CRITICAL'
  | 'NORMAL'
  | 'UNFLAGGED';

/** A numeric analyte, free text, or one of fixed options (Positive / Negative …). */
export type ResultValueType =
  | 'NUMERIC'
  | 'OPTION'
  | 'TEXT';

/** The doctor's review of a released result. */
export type ReviewResultInput = {
  /** The reviewer's note, kept in the audit row. */
  note?: string | null | undefined;
  /** The result (`DiagnosticReport.id`). */
  resultId: string | number;
  /** Set by a Wise card (`propose_result_review`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SaveInvoiceDraftInput = {
  /** The OSCA / PWD ID number presented. */
  discountIdNumber?: string | null | undefined;
  /** SENIOR_CITIZEN or PWD only. */
  discountType?: DiscountType | null | undefined;
  encounterId: string | number;
  /** The draft's `version` the change was made from; refused with STALE_VERSION if it moved. */
  expectedVersion?: number | null | undefined;
  lines: Array<InvoiceLineInput>;
  /** Set by the Wise card (`propose_charges`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SaveMedicalCertificateInput = {
  diagnosisText: string;
  encounterId: string | number;
  /** YYYY-MM-DD. */
  examinedOn: string;
  /** The certificate's `version` the draft was made from; refused (STALE_VERSION) if it changed since. */
  expectedVersion?: number | null | undefined;
  findings?: string | null | undefined;
  /** The draft to replace; a new draft when left out. */
  id?: string | number | null | undefined;
  isFitToWork?: boolean | null | undefined;
  peClassification?: string | null | undefined;
  purpose?: string | null | undefined;
  recommendation?: string | null | undefined;
  restDays?: number | null | undefined;
  /** YYYY-MM-DD. */
  restFrom?: string | null | undefined;
  /** Default MEDICAL_CERTIFICATE. */
  type?: CertificateType | null | undefined;
  /** Set by the Wise card (`propose_medical_certificate`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SaveMyPractitionerInput = {
  /** Default: the user's first name. */
  firstName?: string | null | undefined;
  /** Default: the user's last name. */
  lastName?: string | null | undefined;
  middleName?: string | null | undefined;
  /** PhilHealth accreditation number (PAN). */
  philhealthPan?: string | null | undefined;
  /** YYYY-MM-DD. */
  philhealthPanExpiry?: string | null | undefined;
  /** e.g. "MD, FPCP". */
  postNominals?: string | null | undefined;
  /** YYYY-MM-DD. */
  prcLicenseExpiry?: string | null | undefined;
  /** PRC license number (required, unique). */
  prcLicenseNo: string;
  /** The LGU that issued the PTR, e.g. "Tagbilaran City". */
  ptrIssuedAt?: string | null | undefined;
  /** YYYY-MM-DD. */
  ptrIssuedDate?: string | null | undefined;
  /** Professional tax receipt number. */
  ptrNo?: string | null | undefined;
  /** YYYY-MM-DD. */
  s2LicenseExpiry?: string | null | undefined;
  /** PDEA S2 license number (dangerous drugs, RA 9165). */
  s2LicenseNo?: string | null | undefined;
  specialty?: string | null | undefined;
  subspecialty?: string | null | undefined;
  suffix?: string | null | undefined;
  /** "Dr.", "Dra." */
  title?: string | null | undefined;
  /** Default PHYSICIAN. */
  type?: PractitionerType | null | undefined;
};

export type SavePrescriptionInput = {
  encounterId: string | number;
  /** The prescription's `version` the draft was made from; refused (STALE_VERSION) if it changed since. */
  expectedVersion?: number | null | undefined;
  /** The draft to replace; a new draft when left out. */
  id?: string | number | null | undefined;
  /** A dangerous drug (S2 / yellow Rx, RA 9165). */
  isDangerousDrug?: boolean | null | undefined;
  items: Array<PrescriptionItemInput>;
  notes?: string | null | undefined;
  /** The DOH dangerous-drugs prescription form serial number. */
  s2FormSerialNo?: string | null | undefined;
  /** Set by the Wise card (`propose_prescription`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SavedPromptInput = {
  prompt: string;
  title: string;
};

export type SavedUsagePeriodInput = {
  days: number;
  /** hour, day or month. */
  granularity: string;
};

export type SearchPatientsInput = {
  /** YYYY-MM-DD. */
  birthDate?: string | null | undefined;
  /** Name words, or an exact patient no. / PhilHealth number. */
  query?: string | null | undefined;
};

export type SelectionInput = {
  end: number;
  start: number;
  text: string;
};

/** Sends a patient being served to the next station, keeping their number. */
export type SendQueueTicketInput = {
  station: QueueStation;
  ticketId: string | number;
};

export type ServiceCategory =
  | 'CERTIFICATE'
  | 'CONSULTATION'
  | 'IMAGING'
  | 'LABORATORY'
  | 'MEDICINE'
  | 'OTHER'
  | 'PACKAGE'
  | 'PROCEDURE'
  | 'PROFESSIONAL_FEE'
  | 'SUPPLY'
  | 'VACCINE';

export type SetPasswordWithLinkInput = {
  password: string;
  token: string;
};

export type SetUserStaffRolesInput = {
  /** Every role the user holds at the selected clinic; empty removes them. */
  staffRoles: Array<StaffRole>;
  userId: string | number;
};

export type Severity =
  | 'MILD'
  | 'MODERATE'
  | 'SEVERE';

export type Sex =
  | 'FEMALE'
  | 'MALE';

export type SlotStatus =
  | 'BOOKED'
  | 'FULL'
  | 'ON_LEAVE'
  | 'OPEN'
  | 'PAST';

/** A role a user holds at a clinic (`user_clinic_roles`); a user holds one row per role. */
export type StaffRole =
  | 'ADMIN'
  | 'BILLING_CLERK'
  | 'CASHIER'
  | 'CONTEXT_ADMIN'
  | 'DOCTOR'
  | 'INVENTORY_CLERK'
  | 'MEDTECH'
  | 'MEMBER'
  | 'MIDWIFE'
  | 'NURSE'
  | 'PHARMACIST'
  | 'PHARMACY_ASSISTANT'
  | 'RADTECH'
  | 'RECEPTIONIST'
  | 'SUPER_ADMIN'
  | 'VIEWER';

/** VATABLE (12% VAT included in the price), VAT_EXEMPT, ZERO_RATED. */
export type TaxType =
  | 'VATABLE'
  | 'VAT_EXEMPT'
  | 'ZERO_RATED';

/** Moves a visit along its status machine (`EncounterStatus`). */
export type TransitionEncounterInput = {
  encounterId: string | number;
  /** The encounter's `version` on screen; refused if it changed. */
  expectedVersion?: number | null | undefined;
  /** Why, for a cancellation. */
  reason?: string | null | undefined;
  status: EncounterStatus;
};

export type UpdateDiagnosisInput = {
  id: string | number;
  isFinal?: boolean | null | undefined;
  notes?: string | null | undefined;
  /** A new PRIMARY demotes the previous one. */
  type?: DiagnosisType | null | undefined;
  /** Set by a Wise card (`propose_diagnosis`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type UpdateEncounterNoteInput = {
  assessment?: string | null | undefined;
  /** How the visit ended. */
  disposition?: Disposition | null | undefined;
  encounterId: string | number;
  /** The encounter's `version` the edit was made from; refused with CONFLICT if it changed since. */
  expectedVersion?: number | null | undefined;
  /** YYYY-MM-DD. */
  followUpOn?: string | null | undefined;
  history?: string | null | undefined;
  notes?: string | null | undefined;
  patientInstructions?: string | null | undefined;
  physicalExam?: string | null | undefined;
  plan?: string | null | undefined;
  /** The chief complaint. */
  reason: string;
  /** Set by a Wise card (`propose_encounter_note`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** Changes a patient's contact details; names, birth date, sex and IDs stay. */
export type UpdatePatientInput = {
  /** House no., street, purok / sitio. */
  addressLine?: string | null | undefined;
  /** The barangay of residence: a PSGC code, or a name in the clinic's city. */
  barangay?: string | null | undefined;
  patientId: string | number;
  phone?: string | null | undefined;
  preferredLanguage?: string | null | undefined;
  /** Set by a Wise card (`propose_patient_update`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type UpdateProfileInput = {
  name: string;
};

export type UpdateSavedPromptInput = {
  prompt?: string | null | undefined;
  promptId: string | number;
  title?: string | null | undefined;
};

export type UpdateSavedUsagePeriodInput = {
  days: number;
  /** hour, day or month. */
  granularity: string;
  id: string | number;
};

export type UpdateSkillInput = {
  body: string;
  description: string;
  /** Hash from `skillDetail`, so an edit never overwrites a newer version of the file. */
  expectedHash: string;
  name: string;
};

export type UpdateUserPreferencesInput = {
  /** compact or detailed */
  toolCallDensity?: string | null | undefined;
};

export type UpdateUserRoleInput = {
  /** Organization access level: admin, user or viewer. */
  role: string;
  userId: string | number;
};

export type UsageFilterInput = {
  /** hour, day or month; defaults to the coarsest that fits the chart. */
  granularity?: string | null | undefined;
  period: UsagePeriodRangeInput;
  provider?: string | null | undefined;
  /** Message sources (web, admin, contextRecommendations…). */
  sources?: Array<string> | null | undefined;
  userNames?: Array<string> | null | undefined;
};

export type UsagePeriodRangeInput = {
  /** hour, day or month. */
  unit: string;
  value: number;
};

export type UsagePeriodSelectionInput = {
  /** 24h, 15d, 6m or saved. */
  mode: string;
  savedPeriodId?: string | null | undefined;
};

export type VisitType =
  | 'APE'
  | 'FOLLOW_UP'
  | 'NEW_PATIENT'
  | 'PEME'
  | 'PROCEDURE'
  | 'TELECONSULT';

/** Voids an allergy recorded in error; it stays in the record, struck through. */
export type VoidAllergyInput = {
  id: string | number;
  reason: string;
  /** Set by a Wise card (`propose_remove_allergy`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** Voids a record entry entered in error; it stays in the record, struck through. */
export type VoidEntryInput = {
  id: string | number;
  reason: string;
  /** Set by a Wise card (`propose_void_*`, `propose_bill_step`): verified and settled with the void. */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type VoidInvoiceInput = {
  expectedVersion?: number | null | undefined;
  id: string | number;
  reason: string;
  /** Set by a Wise card (`propose_bill_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type WiseOriginInput = {
  chatId: string | number;
  /** Whether the clinician changed Wise's draft before confirming. */
  edited: boolean;
  toolCallId: string | number;
  /** The proposal tool, e.g. `propose_encounter_note`. */
  toolName: string;
};

export type InvoiceFieldsFragment = { id: string, version: number, encounterId: string | null, invoiceNo: string | null, invoiceDate: string, status: InvoiceStatus, buyerName: string, grossAmount: number, vatableSales: number, vatExemptSales: number, zeroRatedSales: number, vatAmount: number, lessVatScPwd: number, scPwdDiscount: number, otherDiscount: number, netAmount: number, amountPaid: number, balance: number, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, lines: Array<{ id: string, serviceItemId: string | null, serviceItemCode: string | null, category: ServiceCategory | null, description: string, quantity: number, unitPrice: number, taxType: TaxType, vatAmount: number, discountAmount: number, lineTotal: number }>, discounts: Array<{ id: string, type: DiscountType, rate: number, amount: number, vatExempted: number, beneficiaryName: string | null, idNumber: string | null, identificationId: string | null }>, payments: Array<{ id: string, paymentNo: string, method: PaymentMethod, amount: number, tenderedAmount: number | null, changeAmount: number | null, referenceNo: string | null, status: PaymentStatus, receivedAt: string }> };

export type EncounterBillingFieldsFragment = { encounterId: string, clinicId: string, patientId: string, canDraft: boolean, canCollect: boolean, invoices: Array<{ id: string, version: number, encounterId: string | null, invoiceNo: string | null, invoiceDate: string, status: InvoiceStatus, buyerName: string, grossAmount: number, vatableSales: number, vatExemptSales: number, zeroRatedSales: number, vatAmount: number, lessVatScPwd: number, scPwdDiscount: number, otherDiscount: number, netAmount: number, amountPaid: number, balance: number, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, lines: Array<{ id: string, serviceItemId: string | null, serviceItemCode: string | null, category: ServiceCategory | null, description: string, quantity: number, unitPrice: number, taxType: TaxType, vatAmount: number, discountAmount: number, lineTotal: number }>, discounts: Array<{ id: string, type: DiscountType, rate: number, amount: number, vatExempted: number, beneficiaryName: string | null, idNumber: string | null, identificationId: string | null }>, payments: Array<{ id: string, paymentNo: string, method: PaymentMethod, amount: number, tenderedAmount: number | null, changeAmount: number | null, referenceNo: string | null, status: PaymentStatus, receivedAt: string }> }>, priceList: Array<{ id: string, code: string, name: string, category: ServiceCategory, price: number, taxType: TaxType }>, suggestedLines: Array<{ serviceItemId: string | null, description: string, quantity: number, unitPrice: number, taxType: TaxType }>, discountIdentifications: Array<{ id: string, discountType: DiscountType, idNumber: string }> };

export type EncounterBillingQueryVariables = Exact<{
  encounterId: string | number;
}>;


export type EncounterBillingQuery = { encounterBilling: { encounterId: string, clinicId: string, patientId: string, canDraft: boolean, canCollect: boolean, invoices: Array<{ id: string, version: number, encounterId: string | null, invoiceNo: string | null, invoiceDate: string, status: InvoiceStatus, buyerName: string, grossAmount: number, vatableSales: number, vatExemptSales: number, zeroRatedSales: number, vatAmount: number, lessVatScPwd: number, scPwdDiscount: number, otherDiscount: number, netAmount: number, amountPaid: number, balance: number, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, lines: Array<{ id: string, serviceItemId: string | null, serviceItemCode: string | null, category: ServiceCategory | null, description: string, quantity: number, unitPrice: number, taxType: TaxType, vatAmount: number, discountAmount: number, lineTotal: number }>, discounts: Array<{ id: string, type: DiscountType, rate: number, amount: number, vatExempted: number, beneficiaryName: string | null, idNumber: string | null, identificationId: string | null }>, payments: Array<{ id: string, paymentNo: string, method: PaymentMethod, amount: number, tenderedAmount: number | null, changeAmount: number | null, referenceNo: string | null, status: PaymentStatus, receivedAt: string }> }>, priceList: Array<{ id: string, code: string, name: string, category: ServiceCategory, price: number, taxType: TaxType }>, suggestedLines: Array<{ serviceItemId: string | null, description: string, quantity: number, unitPrice: number, taxType: TaxType }>, discountIdentifications: Array<{ id: string, discountType: DiscountType, idNumber: string }> } };

export type SaveInvoiceDraftMutationVariables = Exact<{
  input: SaveInvoiceDraftInput;
}>;


export type SaveInvoiceDraftMutation = { saveInvoiceDraft: { id: string, version: number } };

export type IssueInvoiceMutationVariables = Exact<{
  input: IssueInvoiceInput;
}>;


export type IssueInvoiceMutation = { issueInvoice: { id: string, invoiceNo: string | null } };

export type RecordPaymentMutationVariables = Exact<{
  input: RecordPaymentInput;
}>;


export type RecordPaymentMutation = { recordPayment: { id: string, status: InvoiceStatus, balance: number } };

export type VoidInvoiceMutationVariables = Exact<{
  input: VoidInvoiceInput;
}>;


export type VoidInvoiceMutation = { voidInvoice: { id: string } };

export type ChartDownloadQueryVariables = Exact<{
  toolCallId: string;
}>;


export type ChartDownloadQuery = { chartDownload: string };

export type UpdateChartConfigMutationVariables = Exact<{
  toolCallId: string;
  config: unknown;
}>;


export type UpdateChartConfigMutation = { updateChartConfig: boolean };

export type UpdateMapConfigMutationVariables = Exact<{
  mapId: string;
  config: unknown;
}>;


export type UpdateMapConfigMutation = { updateMapConfig: boolean };

export type ChartPluginsQueryVariables = Exact<{ [key: string]: never; }>;


export type ChartPluginsQuery = { chartPlugins: unknown };

export type ChartPluginSourceQueryVariables = Exact<{
  type: string;
  version: string;
}>;


export type ChartPluginSourceQuery = { chartPluginSource: { source: string, version: string } };

export type ChatFieldsFragment = { id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, forkMetadata: unknown, messages: Array<unknown> };

export type SharedChatFieldsFragment = { id: string, chatId: string, clinicId: string, userId: string, visibility: string, createdAt: string, authorName: string, title: string, forkMetadata: unknown, messageBubbles: Array<{ role: string, charCount: number }> | null };

export type ChatQueryVariables = Exact<{
  chatId: string | number;
}>;


export type ChatQuery = { chat: { id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, forkMetadata: unknown, messages: Array<unknown> } };

export type ChatListQueryVariables = Exact<{
  input?: ChatListInput | null | undefined;
}>;


export type ChatListQuery = { chatList: { groups: Array<{ label: string | null, chats: Array<{ id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, kind: string, shareId: string | null, ownerName: string }> }> } };

export type SearchChatsQueryVariables = Exact<{
  query: string;
  limit?: number | null | undefined;
}>;


export type SearchChatsQuery = { searchChats: Array<{ id: string, title: string, createdAt: number, updatedAt: number, matchedText: string | null }> };

export type ChatForkMetadataQueryVariables = Exact<{
  chatId: string | number;
}>;


export type ChatForkMetadataQuery = { chatForkMetadata: unknown };

export type ChatContextUsageQueryVariables = Exact<{
  input: ChatContextUsageInput;
}>;


export type ChatContextUsageQuery = { chatContextUsage: { tokensUsed: number, contextWindow: number | null } };

export type QueryRowsQueryVariables = Exact<{
  input: QueryRowsInput;
}>;


export type QueryRowsQuery = { queryRows: { columns: Array<string>, rows: Array<unknown>, totalRows: number } };

export type CitationQueryVariables = Exact<{
  queryId: string;
  column: string;
}>;


export type CitationQuery = { citation: unknown };

export type DeleteChatMutationVariables = Exact<{
  chatId: string | number;
}>;


export type DeleteChatMutation = { deleteChat: boolean };

export type StopChatMutationVariables = Exact<{
  chatId: string | number;
}>;


export type StopChatMutation = { stopChat: boolean };

export type CancelChatMutationVariables = Exact<{
  chatId: string | number;
}>;


export type CancelChatMutation = { cancelChat: { outcome: string, chatDeleted: boolean } };

export type RenameChatMutationVariables = Exact<{
  input: RenameChatInput;
}>;


export type RenameChatMutation = { renameChat: boolean };

export type DeleteAllNonStarredChatsMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteAllNonStarredChatsMutation = { deleteAllNonStarredChats: number };

export type SetChatStarredMutationVariables = Exact<{
  chatId: string | number;
  isStarred: boolean;
}>;


export type SetChatStarredMutation = { setChatStarred: boolean };

export type SwitchMessageVersionMutationVariables = Exact<{
  chatId: string | number;
  messageId: string | number;
}>;


export type SwitchMessageVersionMutation = { switchMessageVersion: boolean };

export type SubmitMessageFeedbackMutationVariables = Exact<{
  input: MessageFeedbackInput;
}>;


export type SubmitMessageFeedbackMutation = { submitMessageFeedback: { messageId: string, vote: string, explanation: string | null, createdAt: string } };

export type SharedChatsQueryVariables = Exact<{ [key: string]: never; }>;


export type SharedChatsQuery = { sharedChats: Array<{ id: string, chatId: string, clinicId: string, userId: string, visibility: string, createdAt: string, authorName: string, title: string, forkMetadata: unknown, messageBubbles: Array<{ role: string, charCount: number }> | null }> };

export type SharedChatQueryVariables = Exact<{
  shareId: string | number;
}>;


export type SharedChatQuery = { sharedChat: { userRole: string | null, share: { id: string, chatId: string, clinicId: string, userId: string, visibility: string, createdAt: string, authorName: string, title: string, forkMetadata: unknown, messageBubbles: Array<{ role: string, charCount: number }> | null }, chat: { id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, forkMetadata: unknown, messages: Array<unknown> } } };

export type ChatShareOptionsQueryVariables = Exact<{
  chatId: string | number;
}>;


export type ChatShareOptionsQuery = { chatShareOptions: { shareId: string | null, visibility: string | null, allowedUserIds: Array<string> } };

export type CreateSharedChatMutationVariables = Exact<{
  input: CreateSharedChatInput;
}>;


export type CreateSharedChatMutation = { createSharedChat: { id: string, chatId: string, clinicId: string, userId: string, visibility: string, createdAt: string, authorName: string, title: string, forkMetadata: unknown, messageBubbles: Array<{ role: string, charCount: number }> | null } };

export type UpdateSharedChatAccessMutationVariables = Exact<{
  shareId: string | number;
  allowedUserIds: Array<string> | string;
}>;


export type UpdateSharedChatAccessMutation = { updateSharedChatAccess: boolean };

export type DeleteSharedChatMutationVariables = Exact<{
  shareId: string | number;
}>;


export type DeleteSharedChatMutation = { deleteSharedChat: boolean };

export type ForkSharedChatMutationVariables = Exact<{
  input: ForkSharedChatInput;
}>;


export type ForkSharedChatMutation = { forkSharedChat: { chatId: string } };

export type AskSharedChatMutationVariables = Exact<{
  input: ForkSharedChatInput;
}>;


export type AskSharedChatMutation = { askSharedChat: { chatId: string } };

export type SharedChatQuickQuestionsQueryVariables = Exact<{
  shareId: string | number;
}>;


export type SharedChatQuickQuestionsQuery = { sharedChatQuickQuestions: Array<{ chatId: string, title: string, updatedAt: string }> };

export type ChatShareMembersQueryVariables = Exact<{
  chatId: string | number;
}>;


export type ChatShareMembersQuery = { chatShareMembers: Array<{ id: string, name: string, email: string, role: string }> };

export type ClinicSummaryFieldsFragment = { id: string, name: string, code: string, kind: string, path: string | null, organizationId: string, userRole: string, staffRoles: Array<StaffRole>, createdAt: string, updatedAt: string };

export type CurrentClinicQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentClinicQuery = { currentClinic: { id: string, name: string, code: string, kind: string, path: string | null, organizationId: string, userRole: string, staffRoles: Array<StaffRole>, createdAt: string, updatedAt: string } | null };

export type ClinicsQueryVariables = Exact<{ [key: string]: never; }>;


export type ClinicsQuery = { clinics: Array<{ id: string, name: string, code: string, kind: string, path: string | null, organizationId: string, userRole: string, staffRoles: Array<StaffRole>, createdAt: string, updatedAt: string }> };

export type CreateClinicMutationVariables = Exact<{
  input: CreateClinicInput;
}>;


export type CreateClinicMutation = { createClinic: { id: string, name: string, code: string, kind: string, path: string | null, organizationId: string, userRole: string, staffRoles: Array<StaffRole>, createdAt: string, updatedAt: string } };

export type RenameClinicMutationVariables = Exact<{
  input: RenameClinicInput;
}>;


export type RenameClinicMutation = { renameClinic: { id: string, name: string, code: string, kind: string, path: string | null, organizationId: string, userRole: string, staffRoles: Array<StaffRole>, createdAt: string, updatedAt: string } };

export type DeleteClinicMutationVariables = Exact<{
  clinicId: string | number;
}>;


export type DeleteClinicMutation = { deleteClinic: boolean };

export type SavedPromptsQueryVariables = Exact<{ [key: string]: never; }>;


export type SavedPromptsQuery = { savedPrompts: Array<{ id: string, title: string, prompt: string, createdAt: string, updatedAt: string }> };

export type CreateSavedPromptMutationVariables = Exact<{
  input: SavedPromptInput;
}>;


export type CreateSavedPromptMutation = { createSavedPrompt: { id: string, title: string, prompt: string, createdAt: string, updatedAt: string } };

export type UpdateSavedPromptMutationVariables = Exact<{
  input: UpdateSavedPromptInput;
}>;


export type UpdateSavedPromptMutation = { updateSavedPrompt: { id: string, title: string, prompt: string, createdAt: string, updatedAt: string } };

export type DeleteSavedPromptMutationVariables = Exact<{
  promptId: string | number;
}>;


export type DeleteSavedPromptMutation = { deleteSavedPrompt: boolean };

export type ClinicSavedPromptsQueryVariables = Exact<{
  clinicId: string | number;
}>;


export type ClinicSavedPromptsQuery = { clinicSavedPrompts: Array<{ id: string, title: string, prompt: string, createdAt: string, updatedAt: string }> };

export type DatabaseObjectsQueryVariables = Exact<{ [key: string]: never; }>;


export type DatabaseObjectsQuery = { databaseObjects: Array<{ type: string, database: string, schema: string, table: string, fqdn: string }> };

export type DisplaySettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type DisplaySettingsQuery = { displaySettings: unknown };

export type UpdateDisplaySettingsMutationVariables = Exact<{
  input: unknown;
}>;


export type UpdateDisplaySettingsMutation = { updateDisplaySettings: unknown };

export type VitalSignsFieldsFragment = { id: string, systolicMmHg: number | null, diastolicMmHg: number | null, heartRateBpm: number | null, respiratoryRate: number | null, temperatureC: number | null, spo2Pct: number | null, weightKg: number | null, heightCm: number | null, bmi: number | null, bloodGlucoseMgDl: number | null, painScore: number | null, recordedAt: string, voidedAt: string | null, voidReason: string | null };

export type DiagnosisFieldsFragment = { id: string, icd10Code: string | null, description: string, type: DiagnosisType, isFinal: boolean, sortOrder: number, notes: string | null, voidedAt: string | null, voidReason: string | null };

export type AllergyFieldsFragment = { id: string, allergen: string, type: AllergyType, reaction: string | null, severity: Severity | null, notedAt: string };

export type PrescriptionItemFieldsFragment = { id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number };

export type PrescriptionFieldsFragment = { id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> };

export type MedicalCertificateFieldsFragment = { id: string, version: number, encounterId: string, patientId: string, practitionerId: string, certNo: string, type: CertificateType, documentStatus: DocumentStatus, examinedOn: string, diagnosisText: string | null, findings: string | null, recommendation: string | null, isFitToWork: boolean | null, restFrom: string | null, restTo: string | null, restDays: number | null, purpose: string | null, peClassification: string | null, verificationCode: string, issuedAt: string | null, isVoid: boolean, voidedAt: string | null, voidReason: string | null, createdAt: string };

export type ReferralFieldsFragment = { id: string, encounterId: string, status: ReferralStatus, urgency: OrderPriority, reason: string, specialty: string | null, toExternalDoctor: string | null, toFacility: string | null, referredAt: string, toPractitioner: { id: string, displayName: string } | null };

export type SignatoryFieldsFragment = { name: string, credentials: string | null, specialty: string | null, licenseNumber: string | null, ptrNumber: string | null, s2LicenseNo: string | null, facilityName: string, facilityAddress: string | null, facilityPhone: string | null };

export type EncounterDocumentsFieldsFragment = { prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> }>, medicalCertificates: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, certNo: string, type: CertificateType, documentStatus: DocumentStatus, examinedOn: string, diagnosisText: string | null, findings: string | null, recommendation: string | null, isFitToWork: boolean | null, restFrom: string | null, restTo: string | null, restDays: number | null, purpose: string | null, peClassification: string | null, verificationCode: string, issuedAt: string | null, isVoid: boolean, voidedAt: string | null, voidReason: string | null, createdAt: string }>, referrals: Array<{ id: string, encounterId: string, status: ReferralStatus, urgency: OrderPriority, reason: string, specialty: string | null, toExternalDoctor: string | null, toFacility: string | null, referredAt: string, toPractitioner: { id: string, displayName: string } | null }> };

export type EncounterRecordFieldsFragment = { canEdit: boolean, encounter: { history: string | null, physicalExam: string | null, assessment: string | null, plan: string | null, patientInstructions: string | null, followUpOn: string | null, disposition: Disposition | null, id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null }, vitals: Array<{ id: string, systolicMmHg: number | null, diastolicMmHg: number | null, heartRateBpm: number | null, respiratoryRate: number | null, temperatureC: number | null, spo2Pct: number | null, weightKg: number | null, heightCm: number | null, bmi: number | null, bloodGlucoseMgDl: number | null, painScore: number | null, recordedAt: string, voidedAt: string | null, voidReason: string | null }>, diagnoses: Array<{ id: string, icd10Code: string | null, description: string, type: DiagnosisType, isFinal: boolean, sortOrder: number, notes: string | null, voidedAt: string | null, voidReason: string | null }>, allergies: Array<{ id: string, allergen: string, type: AllergyType, reaction: string | null, severity: Severity | null, notedAt: string }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> }>, medicalCertificates: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, certNo: string, type: CertificateType, documentStatus: DocumentStatus, examinedOn: string, diagnosisText: string | null, findings: string | null, recommendation: string | null, isFitToWork: boolean | null, restFrom: string | null, restTo: string | null, restDays: number | null, purpose: string | null, peClassification: string | null, verificationCode: string, issuedAt: string | null, isVoid: boolean, voidedAt: string | null, voidReason: string | null, createdAt: string }>, referrals: Array<{ id: string, encounterId: string, status: ReferralStatus, urgency: OrderPriority, reason: string, specialty: string | null, toExternalDoctor: string | null, toFacility: string | null, referredAt: string, toPractitioner: { id: string, displayName: string } | null }> };

export type EncounterRecordQueryVariables = Exact<{
  encounterId: string | number;
}>;


export type EncounterRecordQuery = { encounterRecord: { canEdit: boolean, encounter: { history: string | null, physicalExam: string | null, assessment: string | null, plan: string | null, patientInstructions: string | null, followUpOn: string | null, disposition: Disposition | null, id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null }, vitals: Array<{ id: string, systolicMmHg: number | null, diastolicMmHg: number | null, heartRateBpm: number | null, respiratoryRate: number | null, temperatureC: number | null, spo2Pct: number | null, weightKg: number | null, heightCm: number | null, bmi: number | null, bloodGlucoseMgDl: number | null, painScore: number | null, recordedAt: string, voidedAt: string | null, voidReason: string | null }>, diagnoses: Array<{ id: string, icd10Code: string | null, description: string, type: DiagnosisType, isFinal: boolean, sortOrder: number, notes: string | null, voidedAt: string | null, voidReason: string | null }>, allergies: Array<{ id: string, allergen: string, type: AllergyType, reaction: string | null, severity: Severity | null, notedAt: string }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> }>, medicalCertificates: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, certNo: string, type: CertificateType, documentStatus: DocumentStatus, examinedOn: string, diagnosisText: string | null, findings: string | null, recommendation: string | null, isFitToWork: boolean | null, restFrom: string | null, restTo: string | null, restDays: number | null, purpose: string | null, peClassification: string | null, verificationCode: string, issuedAt: string | null, isVoid: boolean, voidedAt: string | null, voidReason: string | null, createdAt: string }>, referrals: Array<{ id: string, encounterId: string, status: ReferralStatus, urgency: OrderPriority, reason: string, specialty: string | null, toExternalDoctor: string | null, toFacility: string | null, referredAt: string, toPractitioner: { id: string, displayName: string } | null }> } | null };

export type PatientOverviewFieldsFragment = { patientId: string, visits: Array<{ encounter: { id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null }, diagnoses: Array<{ id: string, icd10Code: string | null, description: string, type: DiagnosisType, isFinal: boolean, sortOrder: number, notes: string | null, voidedAt: string | null, voidReason: string | null }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> }> }> };

export type PatientOverviewQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientOverviewQuery = { patientOverview: { patientId: string, visits: Array<{ encounter: { id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null }, diagnoses: Array<{ id: string, icd10Code: string | null, description: string, type: DiagnosisType, isFinal: boolean, sortOrder: number, notes: string | null, voidedAt: string | null, voidReason: string | null }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> }> }> } };

export type PatientAllergiesQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientAllergiesQuery = { patientAllergies: Array<{ id: string, allergen: string, type: AllergyType, reaction: string | null, severity: Severity | null, notedAt: string }> };

export type SearchIcd10QueryVariables = Exact<{
  query: string;
}>;


export type SearchIcd10Query = { searchIcd10: Array<{ code: string, title: string }> };

export type PrescriptionPrintQueryVariables = Exact<{
  id: string | number;
}>;


export type PrescriptionPrintQuery = { prescription: { id: string, version: number, encounterId: string, patientId: string, practitionerId: string, rxNo: string, documentStatus: DocumentStatus, status: PrescriptionStatus, isDangerousDrug: boolean, s2FormSerialNo: string | null, verificationCode: string, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, signatory: { name: string, credentials: string | null, specialty: string | null, licenseNumber: string | null, ptrNumber: string | null, s2LicenseNo: string | null, facilityName: string, facilityAddress: string | null, facilityPhone: string | null } | null, items: Array<{ id: string, sortOrder: number, genericName: string, brandName: string | null, strength: string | null, dosageForm: string | null, sig: string, route: string | null, frequency: string | null, durationDays: number | null, isPrn: boolean, quantity: number, unit: string | null, quantityInWords: string | null, dispensedQty: number }> } | null };

export type MedicalCertificatePrintQueryVariables = Exact<{
  id: string | number;
}>;


export type MedicalCertificatePrintQuery = { medicalCertificate: { id: string, version: number, encounterId: string, patientId: string, practitionerId: string, certNo: string, type: CertificateType, documentStatus: DocumentStatus, examinedOn: string, diagnosisText: string | null, findings: string | null, recommendation: string | null, isFitToWork: boolean | null, restFrom: string | null, restTo: string | null, restDays: number | null, purpose: string | null, peClassification: string | null, verificationCode: string, issuedAt: string | null, isVoid: boolean, voidedAt: string | null, voidReason: string | null, createdAt: string, signatory: { name: string, credentials: string | null, specialty: string | null, licenseNumber: string | null, ptrNumber: string | null, s2LicenseNo: string | null, facilityName: string, facilityAddress: string | null, facilityPhone: string | null } | null } | null };

export type PractitionerFieldsFragment = { id: string, type: PractitionerType, title: string | null, firstName: string, middleName: string | null, lastName: string, suffix: string | null, postNominals: string | null, displayName: string, specialty: string | null, subspecialty: string | null, prcLicenseNo: string, prcLicenseExpiry: string | null, ptrNo: string | null, ptrIssuedDate: string | null, ptrIssuedAt: string | null, s2LicenseNo: string | null, s2LicenseExpiry: string | null, philhealthPan: string | null, philhealthPanExpiry: string | null };

export type MyPractitionerQueryVariables = Exact<{ [key: string]: never; }>;


export type MyPractitionerQuery = { myPractitioner: { id: string, type: PractitionerType, title: string | null, firstName: string, middleName: string | null, lastName: string, suffix: string | null, postNominals: string | null, displayName: string, specialty: string | null, subspecialty: string | null, prcLicenseNo: string, prcLicenseExpiry: string | null, ptrNo: string | null, ptrIssuedDate: string | null, ptrIssuedAt: string | null, s2LicenseNo: string | null, s2LicenseExpiry: string | null, philhealthPan: string | null, philhealthPanExpiry: string | null } | null };

export type SaveMyPractitionerMutationVariables = Exact<{
  input: SaveMyPractitionerInput;
}>;


export type SaveMyPractitionerMutation = { saveMyPractitioner: { id: string, type: PractitionerType, title: string | null, firstName: string, middleName: string | null, lastName: string, suffix: string | null, postNominals: string | null, displayName: string, specialty: string | null, subspecialty: string | null, prcLicenseNo: string, prcLicenseExpiry: string | null, ptrNo: string | null, ptrIssuedDate: string | null, ptrIssuedAt: string | null, s2LicenseNo: string | null, s2LicenseExpiry: string | null, philhealthPan: string | null, philhealthPanExpiry: string | null } };

export type UpdateEncounterNoteMutationVariables = Exact<{
  input: UpdateEncounterNoteInput;
}>;


export type UpdateEncounterNoteMutation = { updateEncounterNote: { id: string, version: number } };

export type RecordVitalsMutationVariables = Exact<{
  input: RecordVitalsInput;
}>;


export type RecordVitalsMutation = { recordVitals: { id: string } };

export type VoidVitalsMutationVariables = Exact<{
  input: VoidEntryInput;
}>;


export type VoidVitalsMutation = { voidVitals: { id: string } };

export type AddDiagnosisMutationVariables = Exact<{
  input: AddDiagnosisInput;
}>;


export type AddDiagnosisMutation = { addDiagnosis: { id: string } };

export type UpdateDiagnosisMutationVariables = Exact<{
  input: UpdateDiagnosisInput;
}>;


export type UpdateDiagnosisMutation = { updateDiagnosis: { id: string } };

export type VoidDiagnosisMutationVariables = Exact<{
  input: VoidEntryInput;
}>;


export type VoidDiagnosisMutation = { voidDiagnosis: { id: string } };

export type AddAllergyMutationVariables = Exact<{
  input: AddAllergyInput;
}>;


export type AddAllergyMutation = { addAllergy: { id: string } };

export type VoidAllergyMutationVariables = Exact<{
  input: VoidAllergyInput;
}>;


export type VoidAllergyMutation = { voidAllergy: { id: string } };

export type SavePrescriptionMutationVariables = Exact<{
  input: SavePrescriptionInput;
}>;


export type SavePrescriptionMutation = { savePrescription: { id: string } };

export type IssuePrescriptionMutationVariables = Exact<{
  id: string | number;
  overrideAllergyWarning?: boolean | null | undefined;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type IssuePrescriptionMutation = { issuePrescription: { id: string } };

export type VoidPrescriptionMutationVariables = Exact<{
  input: VoidEntryInput;
}>;


export type VoidPrescriptionMutation = { voidPrescription: { id: string } };

export type SaveMedicalCertificateMutationVariables = Exact<{
  input: SaveMedicalCertificateInput;
}>;


export type SaveMedicalCertificateMutation = { saveMedicalCertificate: { id: string } };

export type IssueMedicalCertificateMutationVariables = Exact<{
  id: string | number;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type IssueMedicalCertificateMutation = { issueMedicalCertificate: { id: string } };

export type VoidMedicalCertificateMutationVariables = Exact<{
  input: VoidEntryInput;
}>;


export type VoidMedicalCertificateMutation = { voidMedicalCertificate: { id: string } };

export type EncounterFieldsFragment = { id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null };

export type EncountersQueryVariables = Exact<{
  patientId: string | number;
}>;


export type EncountersQuery = { encounters: Array<{ id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null }> };

export type CreateEncounterMutationVariables = Exact<{
  input: CreateEncounterInput;
}>;


export type CreateEncounterMutation = { createEncounter: { id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null } };

export type ClinicEncountersQueryVariables = Exact<{
  input: ClinicEncountersInput;
}>;


export type ClinicEncountersQuery = { clinicEncounters: Array<{ id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null }> };

export type TransitionEncounterMutationVariables = Exact<{
  input: TransitionEncounterInput;
}>;


export type TransitionEncounterMutation = { transitionEncounter: { id: string, encounterNo: string, patientId: string, clinicId: string, type: EncounterType, status: EncounterStatus, reason: string | null, notes: string | null, startedAt: string, endedAt: string | null, sourceChatId: string | null, version: number, clinic: { id: string, name: string } | null, practitioner: { id: string, displayName: string } | null } };

export type PatientChatQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientChatQuery = { patientChat: string | null };

export type MapBoundariesQueryVariables = Exact<{ [key: string]: never; }>;


export type MapBoundariesQuery = { mapBoundaries: unknown };

export type ValidateMapBoundaryUrlMutationVariables = Exact<{
  url: string;
}>;


export type ValidateMapBoundaryUrlMutation = { validateMapBoundaryUrl: unknown };

export type AddMapBoundaryMutationVariables = Exact<{
  input: unknown;
}>;


export type AddMapBoundaryMutation = { addMapBoundary: unknown };

export type UpdateMapBoundaryMutationVariables = Exact<{
  input: unknown;
}>;


export type UpdateMapBoundaryMutation = { updateMapBoundary: unknown };

export type DeleteMapBoundaryMutationVariables = Exact<{
  key: string;
}>;


export type DeleteMapBoundaryMutation = { deleteMapBoundary: unknown };

export type MemoryFieldsFragment = { id: string, chatId: string | null, content: string, category: string, supersededBy: string | null, createdAt: string, updatedAt: string };

export type MemoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type MemoriesQuery = { memories: Array<{ id: string, chatId: string | null, content: string, category: string, supersededBy: string | null, createdAt: string, updatedAt: string }> };

export type MemorySettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type MemorySettingsQuery = { memorySettings: { memoryEnabled: boolean } };

export type ClinicMemorySettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type ClinicMemorySettingsQuery = { clinicMemorySettings: { memoryEnabled: boolean } };

export type SetMemoryEnabledMutationVariables = Exact<{
  memoryEnabled: boolean;
}>;


export type SetMemoryEnabledMutation = { setMemoryEnabled: { memoryEnabled: boolean } };

export type EditMemoryMutationVariables = Exact<{
  input: EditMemoryInput;
}>;


export type EditMemoryMutation = { editMemory: { id: string, chatId: string | null, content: string, category: string, supersededBy: string | null, createdAt: string, updatedAt: string } };

export type DeleteMemoryMutationVariables = Exact<{
  memoryId: string | number;
}>;


export type DeleteMemoryMutation = { deleteMemory: boolean };

export type LlmConfigsQueryVariables = Exact<{ [key: string]: never; }>;


export type LlmConfigsQuery = { llmConfigs: unknown };

export type UpsertLlmConfigMutationVariables = Exact<{
  input: unknown;
}>;


export type UpsertLlmConfigMutation = { upsertLlmConfig: unknown };

export type DeleteLlmConfigMutationVariables = Exact<{
  provider: string;
}>;


export type DeleteLlmConfigMutation = { deleteLlmConfig: boolean };

export type KnownModelsQueryVariables = Exact<{ [key: string]: never; }>;


export type KnownModelsQuery = { knownModels: unknown };

export type DefaultModelsQueryVariables = Exact<{ [key: string]: never; }>;


export type DefaultModelsQuery = { defaultModels: unknown };

export type UpdateDefaultModelsMutationVariables = Exact<{
  settings: unknown;
}>;


export type UpdateDefaultModelsMutation = { updateDefaultModels: unknown };

export type DefaultChatModelQueryVariables = Exact<{ [key: string]: never; }>;


export type DefaultChatModelQuery = { defaultChatModel: unknown };

export type AgentSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type AgentSettingsQuery = { agentSettings: unknown };

export type UpdateAgentSettingsMutationVariables = Exact<{
  input: unknown;
}>;


export type UpdateAgentSettingsMutation = { updateAgentSettings: unknown };

export type AvailableModelsQueryVariables = Exact<{ [key: string]: never; }>;


export type AvailableModelsQuery = { availableModels: unknown };

export type KnownTranscribeModelsQueryVariables = Exact<{ [key: string]: never; }>;


export type KnownTranscribeModelsQuery = { knownTranscribeModels: unknown };

export type DiagnosticTestFieldsFragment = { id: string, code: string, name: string, category: DiagnosticCategory, section: string | null, specimenType: string | null, requiresFasting: boolean, loincCode: string | null, parameters: Array<{ id: string, code: string, name: string, unit: string | null, valueType: ResultValueType, options: Array<string>, refLowMale: number | null, refHighMale: number | null, refLowFemale: number | null, refHighFemale: number | null, refRangeText: string | null, sortOrder: number }> };

export type DiagnosticResultFieldsFragment = { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> };

export type DiagnosticOrderSummaryFieldsFragment = { id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string };

export type DiagnosticOrderFieldsFragment = { id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string, items: Array<{ id: string, status: DiagnosticOrderStatus, accessionNo: string | null, specimenCollectedAt: string | null, statusReason: string | null, cancelledAt: string | null, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, result: { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> } | null }> };

export type LabWorklistItemFieldsFragment = { id: string, status: DiagnosticOrderStatus, accessionNo: string | null, specimenCollectedAt: string | null, statusReason: string | null, test: { id: string, code: string, name: string, category: DiagnosticCategory, section: string | null, specimenType: string | null, requiresFasting: boolean, loincCode: string | null, parameters: Array<{ id: string, code: string, name: string, unit: string | null, valueType: ResultValueType, options: Array<string>, refLowMale: number | null, refHighMale: number | null, refLowFemale: number | null, refHighFemale: number | null, refRangeText: string | null, sortOrder: number }> }, result: { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> } | null, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string }, patient: { id: string, patientNo: string, firstName: string, lastName: string, middleName: string | null, birthDate: string, sex: Sex } };

export type DiagnosticTestsQueryVariables = Exact<{ [key: string]: never; }>;


export type DiagnosticTestsQuery = { diagnosticTests: Array<{ id: string, code: string, name: string, category: DiagnosticCategory, section: string | null, specimenType: string | null, requiresFasting: boolean, loincCode: string | null, parameters: Array<{ id: string, code: string, name: string, unit: string | null, valueType: ResultValueType, options: Array<string>, refLowMale: number | null, refHighMale: number | null, refLowFemale: number | null, refHighFemale: number | null, refRangeText: string | null, sortOrder: number }> }> };

export type EncounterDiagnosticOrdersQueryVariables = Exact<{
  encounterId: string | number;
}>;


export type EncounterDiagnosticOrdersQuery = { encounterDiagnosticOrders: Array<{ id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string, items: Array<{ id: string, status: DiagnosticOrderStatus, accessionNo: string | null, specimenCollectedAt: string | null, statusReason: string | null, cancelledAt: string | null, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, result: { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> } | null }> }> };

export type LabWorklistQueryVariables = Exact<{
  statuses?: Array<DiagnosticOrderStatus> | DiagnosticOrderStatus | null | undefined;
}>;


export type LabWorklistQuery = { labWorklist: Array<{ id: string, status: DiagnosticOrderStatus, accessionNo: string | null, specimenCollectedAt: string | null, statusReason: string | null, test: { id: string, code: string, name: string, category: DiagnosticCategory, section: string | null, specimenType: string | null, requiresFasting: boolean, loincCode: string | null, parameters: Array<{ id: string, code: string, name: string, unit: string | null, valueType: ResultValueType, options: Array<string>, refLowMale: number | null, refHighMale: number | null, refLowFemale: number | null, refHighFemale: number | null, refRangeText: string | null, sortOrder: number }> }, result: { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> } | null, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string }, patient: { id: string, patientNo: string, firstName: string, lastName: string, middleName: string | null, birthDate: string, sex: Sex } }> };

export type LabWorklistCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type LabWorklistCountsQuery = { labWorklistCounts: Array<{ status: DiagnosticOrderStatus, count: number }> };

export type CreateDiagnosticOrderMutationVariables = Exact<{
  input: CreateDiagnosticOrderInput;
}>;


export type CreateDiagnosticOrderMutation = { createDiagnosticOrder: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string, items: Array<{ id: string, status: DiagnosticOrderStatus, accessionNo: string | null, specimenCollectedAt: string | null, statusReason: string | null, cancelledAt: string | null, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, result: { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> } | null }> } };

export type CancelDiagnosticOrderMutationVariables = Exact<{
  input: CancelDiagnosticOrderInput;
}>;


export type CancelDiagnosticOrderMutation = { cancelDiagnosticOrder: { id: string, status: DiagnosticOrderStatus } };

export type MarkSpecimenCollectedMutationVariables = Exact<{
  input: MarkSpecimenCollectedInput;
}>;


export type MarkSpecimenCollectedMutation = { markSpecimenCollected: { id: string, status: DiagnosticOrderStatus, accessionNo: string | null } };

export type StartDiagnosticOrderItemMutationVariables = Exact<{
  input: DiagnosticItemStepInput;
}>;


export type StartDiagnosticOrderItemMutation = { startDiagnosticOrderItem: { id: string, status: DiagnosticOrderStatus } };

export type EnterDiagnosticResultMutationVariables = Exact<{
  input: EnterDiagnosticResultInput;
}>;


export type EnterDiagnosticResultMutation = { enterDiagnosticResult: { id: string, status: DiagnosticOrderStatus, accessionNo: string | null, specimenCollectedAt: string | null, statusReason: string | null, test: { id: string, code: string, name: string, category: DiagnosticCategory, section: string | null, specimenType: string | null, requiresFasting: boolean, loincCode: string | null, parameters: Array<{ id: string, code: string, name: string, unit: string | null, valueType: ResultValueType, options: Array<string>, refLowMale: number | null, refHighMale: number | null, refLowFemale: number | null, refHighFemale: number | null, refRangeText: string | null, sortOrder: number }> }, result: { id: string, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, values: Array<{ id: string, parameterId: string | null, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }> } | null, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, status: DiagnosticOrderStatus, clinicalInfo: string | null, isExternal: boolean, externalPhysician: string | null, requestedByName: string | null, createdAt: string }, patient: { id: string, patientNo: string, firstName: string, lastName: string, middleName: string | null, birthDate: string, sex: Sex } } };

export type ReleaseDiagnosticResultMutationVariables = Exact<{
  input: DiagnosticItemStepInput;
}>;


export type ReleaseDiagnosticResultMutation = { releaseDiagnosticResult: { id: string, status: DiagnosticOrderStatus } };

export type PatientFieldsFragment = { id: string, organizationId: string, patientNo: string, givenName: string, middleName: string | null, familyName: string, suffix: string | null, birthDate: string, sex: Sex, phone: string | null, email: string | null, preferredLanguage: string | null, barangay: string | null, consentAt: string | null, createdAt: string, address: { addressLine: string | null, barangayCode: string | null, barangayName: string | null, cityMunicipalityName: string | null } | null, identifications: Array<{ id: string, type: IdentificationType, idNumber: string, label: string }> };

export type PatientDuplicateFieldsFragment = { patientId: string, match: DuplicateMatch, visible: boolean, matchedOn: string, displayName: string, birthYear: number };

export type MyCareClinicsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyCareClinicsQuery = { myCareClinics: Array<{ id: string, name: string, code: string, organizationId: string, cityMunicipalityCode: string | null }> };

export type BarangaysQueryVariables = Exact<{
  cityMunicipalityCode: string;
}>;


export type BarangaysQuery = { barangays: Array<{ code: string, name: string }> };

export type SearchPatientsQueryVariables = Exact<{
  input: SearchPatientsInput;
}>;


export type SearchPatientsQuery = { searchPatients: Array<{ id: string, organizationId: string, patientNo: string, givenName: string, middleName: string | null, familyName: string, suffix: string | null, birthDate: string, sex: Sex, phone: string | null, email: string | null, preferredLanguage: string | null, barangay: string | null, consentAt: string | null, createdAt: string, address: { addressLine: string | null, barangayCode: string | null, barangayName: string | null, cityMunicipalityName: string | null } | null, identifications: Array<{ id: string, type: IdentificationType, idNumber: string, label: string }> }> };

export type PatientQueryVariables = Exact<{
  id: string | number;
}>;


export type PatientQuery = { patient: { id: string, organizationId: string, patientNo: string, givenName: string, middleName: string | null, familyName: string, suffix: string | null, birthDate: string, sex: Sex, phone: string | null, email: string | null, preferredLanguage: string | null, barangay: string | null, consentAt: string | null, createdAt: string, address: { addressLine: string | null, barangayCode: string | null, barangayName: string | null, cityMunicipalityName: string | null } | null, identifications: Array<{ id: string, type: IdentificationType, idNumber: string, label: string }> } | null };

export type CheckPatientDuplicatesQueryVariables = Exact<{
  input: PatientDraftInput;
}>;


export type CheckPatientDuplicatesQuery = { checkPatientDuplicates: Array<{ patientId: string, match: DuplicateMatch, visible: boolean, matchedOn: string, displayName: string, birthYear: number }> };

export type RegisterPatientMutationVariables = Exact<{
  input: RegisterPatientInput;
}>;


export type RegisterPatientMutation = { registerPatient: { patient: { id: string, organizationId: string, patientNo: string, givenName: string, middleName: string | null, familyName: string, suffix: string | null, birthDate: string, sex: Sex, phone: string | null, email: string | null, preferredLanguage: string | null, barangay: string | null, consentAt: string | null, createdAt: string, address: { addressLine: string | null, barangayCode: string | null, barangayName: string | null, cityMunicipalityName: string | null } | null, identifications: Array<{ id: string, type: IdentificationType, idNumber: string, label: string }> } | null, duplicates: Array<{ patientId: string, match: DuplicateMatch, visible: boolean, matchedOn: string, displayName: string, birthYear: number }> } };

export type LinkExistingPatientMutationVariables = Exact<{
  input: LinkExistingPatientInput;
}>;


export type LinkExistingPatientMutation = { linkExistingPatient: { id: string, organizationId: string, patientNo: string, givenName: string, middleName: string | null, familyName: string, suffix: string | null, birthDate: string, sex: Sex, phone: string | null, email: string | null, preferredLanguage: string | null, barangay: string | null, consentAt: string | null, createdAt: string, address: { addressLine: string | null, barangayCode: string | null, barangayName: string | null, cityMunicipalityName: string | null } | null, identifications: Array<{ id: string, type: IdentificationType, idNumber: string, label: string }> } };

export type ExportReportPdfMutationVariables = Exact<{
  chatId: string | number;
  toolCallId: string;
}>;


export type ExportReportPdfMutation = { exportReportPdf: { filename: string, mimeType: string, data: string } };

export type ExportWiseReportPdfMutationVariables = Exact<{
  chatId: string | number;
  toolCallId: string;
}>;


export type ExportWiseReportPdfMutation = { exportWiseReportPdf: { filename: string, mimeType: string, data: string } };

export type SaveReportToChartMutationVariables = Exact<{
  chatId: string | number;
  toolCallId: string;
}>;


export type SaveReportToChartMutation = { saveReportToChart: { id: string } };

export type SavedReportDocumentQueryVariables = Exact<{
  toolCallId: string;
}>;


export type SavedReportDocumentQuery = { savedReportDocument: { id: string, createdAt: string } | null };

export type MyReportsQueryVariables = Exact<{ [key: string]: never; }>;


export type MyReportsQuery = { myReports: Array<{ chatId: string, chatTitle: string, reportId: string, title: string, version: number, toolCallId: string, patientId: string | null, patientName: string | null, updatedAt: string }> };

export type DiagnosticReportFieldsFragment = { id: string, orderItemId: string, status: DiagnosticOrderStatus, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, clinicName: string, values: Array<{ id: string, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }>, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, requestedByName: string | null }, patient: { id: string, patientNo: string, firstName: string, lastName: string, birthDate: string, sex: Sex } };

export type ResultsToReviewQueryVariables = Exact<{ [key: string]: never; }>;


export type ResultsToReviewQuery = { resultsToReview: Array<{ id: string, orderItemId: string, status: DiagnosticOrderStatus, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, clinicName: string, values: Array<{ id: string, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }>, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, requestedByName: string | null }, patient: { id: string, patientNo: string, firstName: string, lastName: string, birthDate: string, sex: Sex } }> };

export type PatientResultsQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientResultsQuery = { patientResults: Array<{ id: string, orderItemId: string, status: DiagnosticOrderStatus, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, clinicName: string, values: Array<{ id: string, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }>, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, requestedByName: string | null }, patient: { id: string, patientNo: string, firstName: string, lastName: string, birthDate: string, sex: Sex } }> };

export type ReviewResultMutationVariables = Exact<{
  input: ReviewResultInput;
}>;


export type ReviewResultMutation = { reviewResult: { id: string, orderItemId: string, status: DiagnosticOrderStatus, findings: string | null, impression: string | null, remarks: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string | null, releasedAt: string | null, reviewedAt: string | null, clinicName: string, values: Array<{ id: string, name: string, value: string, unit: string | null, referenceRange: string | null, flag: ResultFlag | null }>, test: { id: string, code: string, name: string, category: DiagnosticCategory, loincCode: string | null }, order: { id: string, orderNo: string, encounterId: string, priority: OrderPriority, requestedByName: string | null }, patient: { id: string, patientNo: string, firstName: string, lastName: string, birthDate: string, sex: Sex } } };

export type SchedulingPractitionerFieldsFragment = { id: string, name: string, shortName: string, roomName: string | null, userId: string | null };

export type AppointmentFieldsFragment = { id: string, clinicId: string, patientId: string, practitionerId: string, scheduledStart: string, scheduledEnd: string | null, visitType: VisitType, channel: BookingChannel, status: AppointmentStatus, reason: string | null, notes: string | null, reminderSentAt: string | null, cancelledReason: string | null, rescheduledFrom: string | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string, mobileNo: string | null }, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null }, encounter: { id: string, encounterNo: string, status: EncounterStatus } | null };

export type QueueTicketFieldsFragment = { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null };

export type BoardTicketFieldsFragment = { id: string, code: string, isPriority: boolean, status: QueueStatus, station: QueueStation, stationLabel: string, calledAt: string | null };

export type SchedulingPractitionersQueryVariables = Exact<{
  clinicId: string | number;
}>;


export type SchedulingPractitionersQuery = { clinicPractitioners: Array<{ id: string, displayName: string, userId: string | null, clinics: Array<{ clinicId: string, roomName: string | null }> }> };

export type ClinicAppointmentsQueryVariables = Exact<{
  input: ClinicAppointmentsInput;
}>;


export type ClinicAppointmentsQuery = { clinicAppointments: Array<{ id: string, clinicId: string, patientId: string, practitionerId: string, scheduledStart: string, scheduledEnd: string | null, visitType: VisitType, channel: BookingChannel, status: AppointmentStatus, reason: string | null, notes: string | null, reminderSentAt: string | null, cancelledReason: string | null, rescheduledFrom: string | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string, mobileNo: string | null }, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null }, encounter: { id: string, encounterNo: string, status: EncounterStatus } | null }> };

export type AppointmentQueryVariables = Exact<{
  appointmentId: string | number;
}>;


export type AppointmentQuery = { appointment: { id: string, clinicId: string, patientId: string, practitionerId: string, scheduledStart: string, scheduledEnd: string | null, visitType: VisitType, channel: BookingChannel, status: AppointmentStatus, reason: string | null, notes: string | null, reminderSentAt: string | null, cancelledReason: string | null, rescheduledFrom: string | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string, mobileNo: string | null }, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null }, encounter: { id: string, encounterNo: string, status: EncounterStatus } | null } };

export type AppointmentSlotsQueryVariables = Exact<{
  input: AppointmentSlotsInput;
}>;


export type AppointmentSlotsQuery = { appointmentSlots: Array<{ start: string, end: string, status: SlotStatus }> };

export type BookAppointmentMutationVariables = Exact<{
  input: BookAppointmentInput;
}>;


export type BookAppointmentMutation = { bookAppointment: { id: string, clinicId: string, patientId: string, practitionerId: string, scheduledStart: string, scheduledEnd: string | null, visitType: VisitType, channel: BookingChannel, status: AppointmentStatus, reason: string | null, notes: string | null, reminderSentAt: string | null, cancelledReason: string | null, rescheduledFrom: string | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string, mobileNo: string | null }, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null }, encounter: { id: string, encounterNo: string, status: EncounterStatus } | null } };

export type RescheduleAppointmentMutationVariables = Exact<{
  input: RescheduleAppointmentInput;
}>;


export type RescheduleAppointmentMutation = { rescheduleAppointment: { id: string, clinicId: string, patientId: string, practitionerId: string, scheduledStart: string, scheduledEnd: string | null, visitType: VisitType, channel: BookingChannel, status: AppointmentStatus, reason: string | null, notes: string | null, reminderSentAt: string | null, cancelledReason: string | null, rescheduledFrom: string | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string, mobileNo: string | null }, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null }, encounter: { id: string, encounterNo: string, status: EncounterStatus } | null } };

export type CancelAppointmentMutationVariables = Exact<{
  input: CancelAppointmentInput;
}>;


export type CancelAppointmentMutation = { cancelAppointment: { id: string, status: AppointmentStatus } };

export type ConfirmAppointmentMutationVariables = Exact<{
  appointmentId: string | number;
}>;


export type ConfirmAppointmentMutation = { confirmAppointment: { id: string, status: AppointmentStatus } };

export type MarkAppointmentNoShowMutationVariables = Exact<{
  appointmentId: string | number;
}>;


export type MarkAppointmentNoShowMutation = { markAppointmentNoShow: { id: string, status: AppointmentStatus } };

export type QueueTicketsQueryVariables = Exact<{
  input: QueueTicketsInput;
}>;


export type QueueTicketsQuery = { queueTickets: Array<{ id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null }> };

export type QueueBoardQueryVariables = Exact<{
  clinicId: string | number;
}>;


export type QueueBoardQuery = { queueBoard: { clinicName: string, date: string, nowServing: Array<{ id: string, code: string, isPriority: boolean, status: QueueStatus, station: QueueStation, stationLabel: string, calledAt: string | null }>, waiting: Array<{ id: string, code: string, isPriority: boolean, status: QueueStatus, station: QueueStation, stationLabel: string, calledAt: string | null }> } };

export type CheckInPatientMutationVariables = Exact<{
  input: CheckInPatientInput;
}>;


export type CheckInPatientMutation = { checkInPatient: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type CallNextQueueTicketMutationVariables = Exact<{
  input: CallNextInput;
}>;


export type CallNextQueueTicketMutation = { callNextQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } | null };

export type CallQueueTicketMutationVariables = Exact<{
  ticketId: string | number;
}>;


export type CallQueueTicketMutation = { callQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type StartQueueTicketMutationVariables = Exact<{
  ticketId: string | number;
}>;


export type StartQueueTicketMutation = { startQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type SendQueueTicketMutationVariables = Exact<{
  input: SendQueueTicketInput;
}>;


export type SendQueueTicketMutation = { sendQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type CompleteQueueTicketMutationVariables = Exact<{
  ticketId: string | number;
}>;


export type CompleteQueueTicketMutation = { completeQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type SkipQueueTicketMutationVariables = Exact<{
  ticketId: string | number;
}>;


export type SkipQueueTicketMutation = { skipQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type RequeueQueueTicketMutationVariables = Exact<{
  ticketId: string | number;
}>;


export type RequeueQueueTicketMutation = { requeueQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type CancelQueueTicketMutationVariables = Exact<{
  input: CancelQueueTicketInput;
}>;


export type CancelQueueTicketMutation = { cancelQueueTicket: { id: string, clinicId: string, queueDate: string, code: string, prefix: string, number: number, isPriority: boolean, priorityReason: PriorityReason | null, station: QueueStation, stationLabel: string, status: QueueStatus, issuedAt: string, calledAt: string | null, servedAt: string | null, doneAt: string | null, practitioner: { id: string, name: string, shortName: string, roomName: string | null, userId: string | null } | null, encounter: { id: string, encounterNo: string, status: EncounterStatus, reason: string | null, version: number } | null, patient: { id: string, name: string, patientNo: string, birthDate: string, sex: string } | null, appointment: { id: string, status: AppointmentStatus, scheduledStart: string, visitType: VisitType } | null } };

export type CompleteSetupMutationVariables = Exact<{
  input: CompleteSetupInput;
}>;


export type CompleteSetupMutation = { completeSetup: boolean };

export type SkillFieldsFragment = { name: string, description: string, location: string };

export type SkillsQueryVariables = Exact<{ [key: string]: never; }>;


export type SkillsQuery = { skills: Array<{ name: string, description: string, location: string }> };

export type SkillCatalogQueryVariables = Exact<{ [key: string]: never; }>;


export type SkillCatalogQuery = { skillCatalog: Array<{ name: string, description: string, location: string }> };

export type SkillLoadErrorsQueryVariables = Exact<{ [key: string]: never; }>;


export type SkillLoadErrorsQuery = { skillLoadErrors: Array<{ location: string, message: string }> };

export type SkillSaveStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type SkillSaveStatusQuery = { skillSaveStatus: { mode: string, message: string | null } };

export type SkillDetailQueryVariables = Exact<{
  name: string;
}>;


export type SkillDetailQuery = { skillDetail: { name: string, description: string, body: string, hash: string } };

export type CreateSkillMutationVariables = Exact<{
  input: CreateSkillInput;
}>;


export type CreateSkillMutation = { createSkill: { name: string, location: string } };

export type UpdateSkillMutationVariables = Exact<{
  input: UpdateSkillInput;
}>;


export type UpdateSkillMutation = { updateSkill: { name: string, hash: string } };

export type DeleteSkillMutationVariables = Exact<{
  input: DeleteSkillInput;
}>;


export type DeleteSkillMutation = { deleteSkill: boolean };

export type StorageConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type StorageConfigQuery = { storageConfig: unknown };

export type StorageHealthQueryVariables = Exact<{ [key: string]: never; }>;


export type StorageHealthQuery = { storageHealth: unknown };

export type StorageUploadLimitsQueryVariables = Exact<{ [key: string]: never; }>;


export type StorageUploadLimitsQuery = { storageUploadLimits: unknown };

export type StorageUsageQueryVariables = Exact<{ [key: string]: never; }>;


export type StorageUsageQuery = { storageUsage: unknown };

export type PublicConfigQueryVariables = Exact<{ [key: string]: never; }>;


export type PublicConfigQuery = { publicConfig: { loopwiseMode: string, enableUserLogin: boolean, emailVerificationEnabled: boolean, betaAutomationsEnabled: boolean, betaContextRecommendationsEnabled: boolean, betaStoryFiltersEnabled: boolean, betaSubagentsEnabled: boolean, betaCustomStoriesEnabled: boolean, version: string, authProviders: { google: boolean, github: boolean, gitlab: boolean, smtp: boolean } } };

export type AppVersionQueryVariables = Exact<{ [key: string]: never; }>;


export type AppVersionQuery = { version: { version: string, commit: string, buildDate: string } };

export type CheckUpdateQueryVariables = Exact<{ [key: string]: never; }>;


export type CheckUpdateQuery = { checkUpdate: { currentVersion: string, latestVersion: string | null, updateAvailable: boolean } };

export type UsageRecordFieldsFragment = { date: string, messageCount: number, webMessageCount: number, slackMessageCount: number, teamsMessageCount: number, telegramMessageCount: number, mattermostMessageCount: number, discordMessageCount: number, whatsappMessageCount: number, adminMessageCount: number, mcpMessageCount: number, contextRecommendationsMessageCount: number, inputNoCacheTokens: number, inputCacheReadTokens: number, inputCacheWriteTokens: number, outputTotalTokens: number, totalTokens: number, inputNoCacheCost: number, inputCacheReadCost: number, inputCacheWriteCost: number, outputCost: number, totalCost: number };

export type UsagePeriodSelectionFieldsFragment = { mode: string, savedPeriodId: string | null };

export type SavedUsagePeriodFieldsFragment = { id: string, days: number, granularity: string };

export type UsageMessagesQueryVariables = Exact<{
  filter: UsageFilterInput;
}>;


export type UsageMessagesQuery = { usageMessages: Array<{ date: string, messageCount: number, webMessageCount: number, slackMessageCount: number, teamsMessageCount: number, telegramMessageCount: number, mattermostMessageCount: number, discordMessageCount: number, whatsappMessageCount: number, adminMessageCount: number, mcpMessageCount: number, contextRecommendationsMessageCount: number, inputNoCacheTokens: number, inputCacheReadTokens: number, inputCacheWriteTokens: number, outputTotalTokens: number, totalTokens: number, inputNoCacheCost: number, inputCacheReadCost: number, inputCacheWriteCost: number, outputCost: number, totalCost: number }> };

export type UsageByUserQueryVariables = Exact<{
  filter: UsageFilterInput;
}>;


export type UsageByUserQuery = { usageByUser: Array<{ date: string, users: Array<{ userName: string, messageCount: number, totalTokens: number, totalCost: number }> }> };

export type UsageTotalQueryVariables = Exact<{
  filter: UsageFilterInput;
}>;


export type UsageTotalQuery = { usageTotal: { totalMessages: number, uniqueUsers: number } };

export type UsageProvidersQueryVariables = Exact<{ [key: string]: never; }>;


export type UsageProvidersQuery = { usageProviders: Array<string> };

export type UsageUserFacetsQueryVariables = Exact<{ [key: string]: never; }>;


export type UsageUserFacetsQuery = { usageUserFacets: Array<{ userName: string, chatCount: number }> };

export type UsagePeriodSettingsQueryVariables = Exact<{
  clinicId: string | number;
}>;


export type UsagePeriodSettingsQuery = { usagePeriodSettings: { selection: { mode: string, savedPeriodId: string | null } | null, savedPeriods: Array<{ id: string, days: number, granularity: string }> } };

export type UpdateUsagePeriodSelectionMutationVariables = Exact<{
  clinicId: string | number;
  selection: UsagePeriodSelectionInput;
}>;


export type UpdateUsagePeriodSelectionMutation = { updateUsagePeriodSelection: { mode: string, savedPeriodId: string | null } | null };

export type CreateSavedUsagePeriodMutationVariables = Exact<{
  clinicId: string | number;
  savedPeriod: SavedUsagePeriodInput;
}>;


export type CreateSavedUsagePeriodMutation = { createSavedUsagePeriod: { id: string, days: number, granularity: string } };

export type UpdateSavedUsagePeriodMutationVariables = Exact<{
  clinicId: string | number;
  savedPeriod: UpdateSavedUsagePeriodInput;
}>;


export type UpdateSavedUsagePeriodMutation = { updateSavedUsagePeriod: { id: string, days: number, granularity: string } };

export type DeleteSavedUsagePeriodMutationVariables = Exact<{
  clinicId: string | number;
  id: string | number;
}>;


export type DeleteSavedUsagePeriodMutation = { deleteSavedUsagePeriod: { id: string, selection: { mode: string, savedPeriodId: string | null } | null } };

export type ManagedUserFieldsFragment = { id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string };

export type CurrentOrgRoleQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentOrgRoleQuery = { currentOrgRole: string };

export type ManagedUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type ManagedUsersQuery = { managedUsers: Array<{ id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string }> };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;


export type CreateUserMutation = { createUser: { url: string, expiresAt: string, user: { id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string } } };

export type CreatePasswordLinkMutationVariables = Exact<{
  userId: string | number;
}>;


export type CreatePasswordLinkMutation = { createPasswordLink: { url: string, expiresAt: string, user: { id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string } } };

export type UpdateUserRoleMutationVariables = Exact<{
  input: UpdateUserRoleInput;
}>;


export type UpdateUserRoleMutation = { updateUserRole: { id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string } };

export type SetUserStaffRolesMutationVariables = Exact<{
  input: SetUserStaffRolesInput;
}>;


export type SetUserStaffRolesMutation = { setUserStaffRoles: { id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string } };

export type SetUserActiveMutationVariables = Exact<{
  userId: string | number;
  active: boolean;
}>;


export type SetUserActiveMutation = { setUserActive: { id: string, name: string, email: string, role: string, staffRoles: Array<StaffRole>, status: ManagedUserStatus, createdAt: string } };

export type PasswordLinkQueryVariables = Exact<{
  token: string;
}>;


export type PasswordLinkQuery = { passwordLink: { name: string, email: string, isInvite: boolean } | null };

export type SetPasswordWithLinkMutationVariables = Exact<{
  input: SetPasswordWithLinkInput;
}>;


export type SetPasswordWithLinkMutation = { setPasswordWithLink: string };

export type HasUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type HasUsersQuery = { hasUsers: boolean };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { me: { id: string, name: string, email: string, image: string | null, emailVerified: boolean, requiresPasswordReset: boolean, isActive: boolean } };

export type UpdateProfileMutationVariables = Exact<{
  input: UpdateProfileInput;
}>;


export type UpdateProfileMutation = { updateProfile: { id: string, name: string } };

export type ModifyPasswordMutationVariables = Exact<{
  input: ModifyPasswordInput;
}>;


export type ModifyPasswordMutation = { modifyPassword: boolean };

export type UserPreferencesQueryVariables = Exact<{ [key: string]: never; }>;


export type UserPreferencesQuery = { userPreferences: unknown };

export type UpdateUserPreferencesMutationVariables = Exact<{
  input: UpdateUserPreferencesInput;
}>;


export type UpdateUserPreferencesMutation = { updateUserPreferences: unknown };

export type ChangePasswordMutationVariables = Exact<{
  input: ChangePasswordInput;
}>;


export type ChangePasswordMutation = { changePassword: boolean };

export type WiseIssuePrescriptionMutationVariables = Exact<{
  id: string | number;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseIssuePrescriptionMutation = { issuePrescription: { id: string } };

export type WiseIssueMedicalCertificateMutationVariables = Exact<{
  id: string | number;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseIssueMedicalCertificateMutation = { issueMedicalCertificate: { id: string } };

export type WiseSaveReportToChartMutationVariables = Exact<{
  chatId: string | number;
  toolCallId: string;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseSaveReportToChartMutation = { saveReportToChart: { id: string } };

export type UpdatePatientMutationVariables = Exact<{
  input: UpdatePatientInput;
}>;


export type UpdatePatientMutation = { updatePatient: { id: string, phone: string | null, preferredLanguage: string | null, barangay: string | null, address: { addressLine: string | null } | null } };

export type WisePatientContactQueryVariables = Exact<{
  id: string | number;
}>;


export type WisePatientContactQuery = { patient: { id: string, givenName: string, familyName: string, phone: string | null, preferredLanguage: string | null, barangay: string | null, address: { addressLine: string | null } | null } | null };

export type WiseProposalOutcomeFieldsFragment = { toolCallId: string, toolName: string, status: string, resourceId: string | null };

export type WiseProposalOutcomesQueryVariables = Exact<{
  chatId: string | number;
}>;


export type WiseProposalOutcomesQuery = { wiseProposalOutcomes: Array<{ toolCallId: string, toolName: string, status: string, resourceId: string | null }> };

export type CancelWiseProposalMutationVariables = Exact<{
  input: WiseOriginInput;
}>;


export type CancelWiseProposalMutation = { cancelWiseProposal: { toolCallId: string, toolName: string, status: string, resourceId: string | null } };

export type WiseToolSettingsQueryVariables = Exact<{
  organizationId?: string | number | null | undefined;
}>;


export type WiseToolSettingsQuery = { wiseToolSettings: { organizationId: string | null, organizations: Array<{ id: string, name: string, isAdmin: boolean }>, tools: Array<{ name: string, label: string, summary: string, kind: string, category: string, locked: boolean, comingSoon: boolean, organizationDefault: boolean, organizationEnabled: boolean, myEnabled: boolean, enabled: boolean }> } };

export type SetWiseToolEnabledMutationVariables = Exact<{
  organizationId: string | number;
  toolName: string;
  enabled: boolean;
}>;


export type SetWiseToolEnabledMutation = { setWiseToolEnabled: boolean };

export type SetMyWiseToolEnabledMutationVariables = Exact<{
  toolName: string;
  enabled: boolean;
}>;


export type SetMyWiseToolEnabledMutation = { setMyWiseToolEnabled: boolean };

export const InvoiceFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InvoiceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Invoice"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceNo"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceDate"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"buyerName"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"serviceItemId"}},{"kind":"Field","name":{"kind":"Name","value":"serviceItemCode"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}},{"kind":"Field","name":{"kind":"Name","value":"vatAmount"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"discounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"rate"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"vatExempted"}},{"kind":"Field","name":{"kind":"Name","value":"beneficiaryName"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"identificationId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"paymentNo"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"tenderedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"changeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"referenceNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"grossAmount"}},{"kind":"Field","name":{"kind":"Name","value":"vatableSales"}},{"kind":"Field","name":{"kind":"Name","value":"vatExemptSales"}},{"kind":"Field","name":{"kind":"Name","value":"zeroRatedSales"}},{"kind":"Field","name":{"kind":"Name","value":"vatAmount"}},{"kind":"Field","name":{"kind":"Name","value":"lessVatScPwd"}},{"kind":"Field","name":{"kind":"Name","value":"scPwdDiscount"}},{"kind":"Field","name":{"kind":"Name","value":"otherDiscount"}},{"kind":"Field","name":{"kind":"Name","value":"netAmount"}},{"kind":"Field","name":{"kind":"Name","value":"amountPaid"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<InvoiceFieldsFragment, unknown>;
export const EncounterBillingFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterBillingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterBilling"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"canDraft"}},{"kind":"Field","name":{"kind":"Name","value":"canCollect"}},{"kind":"Field","name":{"kind":"Name","value":"invoices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InvoiceFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priceList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"price"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}}]}},{"kind":"Field","name":{"kind":"Name","value":"suggestedLines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"serviceItemId"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}}]}},{"kind":"Field","name":{"kind":"Name","value":"discountIdentifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"discountType"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InvoiceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Invoice"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceNo"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceDate"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"buyerName"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"serviceItemId"}},{"kind":"Field","name":{"kind":"Name","value":"serviceItemCode"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}},{"kind":"Field","name":{"kind":"Name","value":"vatAmount"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"discounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"rate"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"vatExempted"}},{"kind":"Field","name":{"kind":"Name","value":"beneficiaryName"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"identificationId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"paymentNo"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"tenderedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"changeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"referenceNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"grossAmount"}},{"kind":"Field","name":{"kind":"Name","value":"vatableSales"}},{"kind":"Field","name":{"kind":"Name","value":"vatExemptSales"}},{"kind":"Field","name":{"kind":"Name","value":"zeroRatedSales"}},{"kind":"Field","name":{"kind":"Name","value":"vatAmount"}},{"kind":"Field","name":{"kind":"Name","value":"lessVatScPwd"}},{"kind":"Field","name":{"kind":"Name","value":"scPwdDiscount"}},{"kind":"Field","name":{"kind":"Name","value":"otherDiscount"}},{"kind":"Field","name":{"kind":"Name","value":"netAmount"}},{"kind":"Field","name":{"kind":"Name","value":"amountPaid"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<EncounterBillingFieldsFragment, unknown>;
export const ChatFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Chat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messages"}}]}}]} as unknown as DocumentNode<ChatFieldsFragment, unknown>;
export const SharedChatFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}}]} as unknown as DocumentNode<SharedChatFieldsFragment, unknown>;
export const ClinicSummaryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<ClinicSummaryFieldsFragment, unknown>;
export const SignatoryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignatoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DocumentSignatory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"licenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"facilityName"}},{"kind":"Field","name":{"kind":"Name","value":"facilityAddress"}},{"kind":"Field","name":{"kind":"Name","value":"facilityPhone"}}]}}]} as unknown as DocumentNode<SignatoryFieldsFragment, unknown>;
export const EncounterFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<EncounterFieldsFragment, unknown>;
export const VitalSignsFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"VitalSignsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VitalSigns"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"systolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"diastolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"heartRateBpm"}},{"kind":"Field","name":{"kind":"Name","value":"respiratoryRate"}},{"kind":"Field","name":{"kind":"Name","value":"temperatureC"}},{"kind":"Field","name":{"kind":"Name","value":"spo2Pct"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"heightCm"}},{"kind":"Field","name":{"kind":"Name","value":"bmi"}},{"kind":"Field","name":{"kind":"Name","value":"bloodGlucoseMgDl"}},{"kind":"Field","name":{"kind":"Name","value":"painScore"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}}]} as unknown as DocumentNode<VitalSignsFieldsFragment, unknown>;
export const DiagnosisFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}}]} as unknown as DocumentNode<DiagnosisFieldsFragment, unknown>;
export const AllergyFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"allergen"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"notedAt"}}]}}]} as unknown as DocumentNode<AllergyFieldsFragment, unknown>;
export const PrescriptionItemFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}}]} as unknown as DocumentNode<PrescriptionItemFieldsFragment, unknown>;
export const PrescriptionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}}]} as unknown as DocumentNode<PrescriptionFieldsFragment, unknown>;
export const MedicalCertificateFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"certNo"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"recommendation"}},{"kind":"Field","name":{"kind":"Name","value":"isFitToWork"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restTo"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"peClassification"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isVoid"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<MedicalCertificateFieldsFragment, unknown>;
export const ReferralFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferralFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Referral"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"toExternalDoctor"}},{"kind":"Field","name":{"kind":"Name","value":"toFacility"}},{"kind":"Field","name":{"kind":"Name","value":"referredAt"}},{"kind":"Field","name":{"kind":"Name","value":"toPractitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<ReferralFieldsFragment, unknown>;
export const EncounterDocumentsFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterDocumentsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"medicalCertificates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"referrals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferralFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"certNo"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"recommendation"}},{"kind":"Field","name":{"kind":"Name","value":"isFitToWork"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restTo"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"peClassification"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isVoid"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferralFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Referral"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"toExternalDoctor"}},{"kind":"Field","name":{"kind":"Name","value":"toFacility"}},{"kind":"Field","name":{"kind":"Name","value":"referredAt"}},{"kind":"Field","name":{"kind":"Name","value":"toPractitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<EncounterDocumentsFieldsFragment, unknown>;
export const EncounterRecordFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}},{"kind":"Field","name":{"kind":"Name","value":"history"}},{"kind":"Field","name":{"kind":"Name","value":"physicalExam"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"patientInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"followUpOn"}},{"kind":"Field","name":{"kind":"Name","value":"disposition"}}]}},{"kind":"Field","name":{"kind":"Name","value":"vitals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"VitalSignsFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allergies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AllergyFields"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterDocumentsFields"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"certNo"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"recommendation"}},{"kind":"Field","name":{"kind":"Name","value":"isFitToWork"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restTo"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"peClassification"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isVoid"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferralFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Referral"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"toExternalDoctor"}},{"kind":"Field","name":{"kind":"Name","value":"toFacility"}},{"kind":"Field","name":{"kind":"Name","value":"referredAt"}},{"kind":"Field","name":{"kind":"Name","value":"toPractitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"VitalSignsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VitalSigns"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"systolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"diastolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"heartRateBpm"}},{"kind":"Field","name":{"kind":"Name","value":"respiratoryRate"}},{"kind":"Field","name":{"kind":"Name","value":"temperatureC"}},{"kind":"Field","name":{"kind":"Name","value":"spo2Pct"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"heightCm"}},{"kind":"Field","name":{"kind":"Name","value":"bmi"}},{"kind":"Field","name":{"kind":"Name","value":"bloodGlucoseMgDl"}},{"kind":"Field","name":{"kind":"Name","value":"painScore"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"allergen"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"notedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterDocumentsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"medicalCertificates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"referrals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferralFields"}}]}}]}}]} as unknown as DocumentNode<EncounterRecordFieldsFragment, unknown>;
export const PatientOverviewFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientOverviewFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientOverview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"visits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}}]} as unknown as DocumentNode<PatientOverviewFieldsFragment, unknown>;
export const PractitionerFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Practitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"postNominals"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"subspecialty"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNo"}},{"kind":"Field","name":{"kind":"Name","value":"ptrIssuedDate"}},{"kind":"Field","name":{"kind":"Name","value":"ptrIssuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPan"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPanExpiry"}}]}}]} as unknown as DocumentNode<PractitionerFieldsFragment, unknown>;
export const MemoryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MemoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Memory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"supersededBy"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<MemoryFieldsFragment, unknown>;
export const DiagnosticResultFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}}]} as unknown as DocumentNode<DiagnosticResultFieldsFragment, unknown>;
export const DiagnosticOrderFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}},{"kind":"Field","name":{"kind":"Name","value":"specimenCollectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledAt"}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticResultFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}}]} as unknown as DocumentNode<DiagnosticOrderFieldsFragment, unknown>;
export const DiagnosticTestFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticTest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"section"}},{"kind":"Field","name":{"kind":"Name","value":"specimenType"}},{"kind":"Field","name":{"kind":"Name","value":"requiresFasting"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"valueType"}},{"kind":"Field","name":{"kind":"Name","value":"options"}},{"kind":"Field","name":{"kind":"Name","value":"refLowMale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighMale"}},{"kind":"Field","name":{"kind":"Name","value":"refLowFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refRangeText"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<DiagnosticTestFieldsFragment, unknown>;
export const DiagnosticOrderSummaryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrderSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<DiagnosticOrderSummaryFieldsFragment, unknown>;
export const LabWorklistItemFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LabWorklistItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabWorklistItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}},{"kind":"Field","name":{"kind":"Name","value":"specimenCollectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticTestFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticResultFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticTest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"section"}},{"kind":"Field","name":{"kind":"Name","value":"specimenType"}},{"kind":"Field","name":{"kind":"Name","value":"requiresFasting"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"valueType"}},{"kind":"Field","name":{"kind":"Name","value":"options"}},{"kind":"Field","name":{"kind":"Name","value":"refLowMale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighMale"}},{"kind":"Field","name":{"kind":"Name","value":"refLowFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refRangeText"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrderSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<LabWorklistItemFieldsFragment, unknown>;
export const PatientFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"barangayCode"}},{"kind":"Field","name":{"kind":"Name","value":"barangayName"}},{"kind":"Field","name":{"kind":"Name","value":"cityMunicipalityName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<PatientFieldsFragment, unknown>;
export const PatientDuplicateFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientDuplicateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDuplicate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"match"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"matchedOn"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"birthYear"}}]}}]} as unknown as DocumentNode<PatientDuplicateFieldsFragment, unknown>;
export const DiagnosticReportFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticReportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticReport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderItemId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"clinicName"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<DiagnosticReportFieldsFragment, unknown>;
export const SchedulingPractitionerFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}}]} as unknown as DocumentNode<SchedulingPractitionerFieldsFragment, unknown>;
export const AppointmentFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEnd"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"reminderSentAt"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledReason"}},{"kind":"Field","name":{"kind":"Name","value":"rescheduledFrom"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"mobileNo"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}}]} as unknown as DocumentNode<AppointmentFieldsFragment, unknown>;
export const QueueTicketFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}}]} as unknown as DocumentNode<QueueTicketFieldsFragment, unknown>;
export const BoardTicketFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BoardTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BoardTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}}]}}]} as unknown as DocumentNode<BoardTicketFieldsFragment, unknown>;
export const SkillFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SkillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Skill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"}}]}}]} as unknown as DocumentNode<SkillFieldsFragment, unknown>;
export const UsageRecordFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsageRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsageRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"messageCount"}},{"kind":"Field","name":{"kind":"Name","value":"webMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"slackMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"teamsMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"telegramMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mattermostMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"discordMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"whatsappMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"adminMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mcpMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"contextRecommendationsMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"inputNoCacheTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheReadTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheWriteTokens"}},{"kind":"Field","name":{"kind":"Name","value":"outputTotalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputNoCacheCost"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheReadCost"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheWriteCost"}},{"kind":"Field","name":{"kind":"Name","value":"outputCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}}]} as unknown as DocumentNode<UsageRecordFieldsFragment, unknown>;
export const UsagePeriodSelectionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsagePeriodSelectionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsagePeriodSelection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"savedPeriodId"}}]}}]} as unknown as DocumentNode<UsagePeriodSelectionFieldsFragment, unknown>;
export const SavedUsagePeriodFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SavedUsagePeriodFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SavedUsagePeriod"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"granularity"}}]}}]} as unknown as DocumentNode<SavedUsagePeriodFieldsFragment, unknown>;
export const ManagedUserFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<ManagedUserFieldsFragment, unknown>;
export const WiseProposalOutcomeFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WiseProposalOutcomeFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WiseProposalOutcome"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"toolName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}}]}}]} as unknown as DocumentNode<WiseProposalOutcomeFieldsFragment, unknown>;
export const EncounterBillingDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EncounterBilling"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounterBilling"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterBillingFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"InvoiceFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Invoice"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceNo"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceDate"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"buyerName"}},{"kind":"Field","name":{"kind":"Name","value":"lines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"serviceItemId"}},{"kind":"Field","name":{"kind":"Name","value":"serviceItemCode"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}},{"kind":"Field","name":{"kind":"Name","value":"vatAmount"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"lineTotal"}}]}},{"kind":"Field","name":{"kind":"Name","value":"discounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"rate"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"vatExempted"}},{"kind":"Field","name":{"kind":"Name","value":"beneficiaryName"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"identificationId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"payments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"paymentNo"}},{"kind":"Field","name":{"kind":"Name","value":"method"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}},{"kind":"Field","name":{"kind":"Name","value":"tenderedAmount"}},{"kind":"Field","name":{"kind":"Name","value":"changeAmount"}},{"kind":"Field","name":{"kind":"Name","value":"referenceNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"grossAmount"}},{"kind":"Field","name":{"kind":"Name","value":"vatableSales"}},{"kind":"Field","name":{"kind":"Name","value":"vatExemptSales"}},{"kind":"Field","name":{"kind":"Name","value":"zeroRatedSales"}},{"kind":"Field","name":{"kind":"Name","value":"vatAmount"}},{"kind":"Field","name":{"kind":"Name","value":"lessVatScPwd"}},{"kind":"Field","name":{"kind":"Name","value":"scPwdDiscount"}},{"kind":"Field","name":{"kind":"Name","value":"otherDiscount"}},{"kind":"Field","name":{"kind":"Name","value":"netAmount"}},{"kind":"Field","name":{"kind":"Name","value":"amountPaid"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterBillingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterBilling"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"canDraft"}},{"kind":"Field","name":{"kind":"Name","value":"canCollect"}},{"kind":"Field","name":{"kind":"Name","value":"invoices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"InvoiceFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priceList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"price"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}}]}},{"kind":"Field","name":{"kind":"Name","value":"suggestedLines"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"serviceItemId"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"taxType"}}]}},{"kind":"Field","name":{"kind":"Name","value":"discountIdentifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"discountType"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}}]}}]}}]} as unknown as DocumentNode<EncounterBillingQuery, EncounterBillingQueryVariables>;
export const SaveInvoiceDraftDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveInvoiceDraft"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveInvoiceDraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveInvoiceDraft"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<SaveInvoiceDraftMutation, SaveInvoiceDraftMutationVariables>;
export const IssueInvoiceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IssueInvoice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"IssueInvoiceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issueInvoice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"invoiceNo"}}]}}]}}]} as unknown as DocumentNode<IssueInvoiceMutation, IssueInvoiceMutationVariables>;
export const RecordPaymentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordPayment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordPaymentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordPayment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"balance"}}]}}]}}]} as unknown as DocumentNode<RecordPaymentMutation, RecordPaymentMutationVariables>;
export const VoidInvoiceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidInvoice"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidInvoiceInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidInvoice"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidInvoiceMutation, VoidInvoiceMutationVariables>;
export const ChartDownloadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChartDownload"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chartDownload"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}]}]}}]} as unknown as DocumentNode<ChartDownloadQuery, ChartDownloadQueryVariables>;
export const UpdateChartConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateChartConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"config"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateChartConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}},{"kind":"Argument","name":{"kind":"Name","value":"config"},"value":{"kind":"Variable","name":{"kind":"Name","value":"config"}}}]}]}}]} as unknown as DocumentNode<UpdateChartConfigMutation, UpdateChartConfigMutationVariables>;
export const UpdateMapConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMapConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mapId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"config"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMapConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"mapId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mapId"}}},{"kind":"Argument","name":{"kind":"Name","value":"config"},"value":{"kind":"Variable","name":{"kind":"Name","value":"config"}}}]}]}}]} as unknown as DocumentNode<UpdateMapConfigMutation, UpdateMapConfigMutationVariables>;
export const ChartPluginsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChartPlugins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chartPlugins"}}]}}]} as unknown as DocumentNode<ChartPluginsQuery, ChartPluginsQueryVariables>;
export const ChartPluginSourceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChartPluginSource"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"version"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chartPluginSource"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"version"},"value":{"kind":"Variable","name":{"kind":"Name","value":"version"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<ChartPluginSourceQuery, ChartPluginSourceQueryVariables>;
export const ChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Chat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ChatFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Chat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messages"}}]}}]} as unknown as DocumentNode<ChatQuery, ChatQueryVariables>;
export const ChatListDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatList"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ChatListInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatList"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"chats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"shareId"}},{"kind":"Field","name":{"kind":"Name","value":"ownerName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ChatListQuery, ChatListQueryVariables>;
export const SearchChatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchChats"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchChats"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"matchedText"}}]}}]}}]} as unknown as DocumentNode<SearchChatsQuery, SearchChatsQueryVariables>;
export const ChatForkMetadataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatForkMetadata"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatForkMetadata"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}]}]}}]} as unknown as DocumentNode<ChatForkMetadataQuery, ChatForkMetadataQueryVariables>;
export const ChatContextUsageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatContextUsage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChatContextUsageInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatContextUsage"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tokensUsed"}},{"kind":"Field","name":{"kind":"Name","value":"contextWindow"}}]}}]}}]} as unknown as DocumentNode<ChatContextUsageQuery, ChatContextUsageQueryVariables>;
export const QueryRowsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"QueryRows"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"QueryRowsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"queryRows"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"columns"}},{"kind":"Field","name":{"kind":"Name","value":"rows"}},{"kind":"Field","name":{"kind":"Name","value":"totalRows"}}]}}]}}]} as unknown as DocumentNode<QueryRowsQuery, QueryRowsQueryVariables>;
export const CitationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Citation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"queryId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"column"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"citation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"queryId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"queryId"}}},{"kind":"Argument","name":{"kind":"Name","value":"column"},"value":{"kind":"Variable","name":{"kind":"Name","value":"column"}}}]}]}}]} as unknown as DocumentNode<CitationQuery, CitationQueryVariables>;
export const DeleteChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}]}]}}]} as unknown as DocumentNode<DeleteChatMutation, DeleteChatMutationVariables>;
export const StopChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StopChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"stopChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}]}]}}]} as unknown as DocumentNode<StopChatMutation, StopChatMutationVariables>;
export const CancelChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"outcome"}},{"kind":"Field","name":{"kind":"Name","value":"chatDeleted"}}]}}]}}]} as unknown as DocumentNode<CancelChatMutation, CancelChatMutationVariables>;
export const RenameChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenameChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RenameChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renameChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<RenameChatMutation, RenameChatMutationVariables>;
export const DeleteAllNonStarredChatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteAllNonStarredChats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteAllNonStarredChats"}}]}}]} as unknown as DocumentNode<DeleteAllNonStarredChatsMutation, DeleteAllNonStarredChatsMutationVariables>;
export const SetChatStarredDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetChatStarred"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isStarred"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setChatStarred"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"isStarred"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isStarred"}}}]}]}}]} as unknown as DocumentNode<SetChatStarredMutation, SetChatStarredMutationVariables>;
export const SwitchMessageVersionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SwitchMessageVersion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"switchMessageVersion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"messageId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"messageId"}}}]}]}}]} as unknown as DocumentNode<SwitchMessageVersionMutation, SwitchMessageVersionMutationVariables>;
export const SubmitMessageFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitMessageFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MessageFeedbackInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitMessageFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messageId"}},{"kind":"Field","name":{"kind":"Name","value":"vote"}},{"kind":"Field","name":{"kind":"Name","value":"explanation"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<SubmitMessageFeedbackMutation, SubmitMessageFeedbackMutationVariables>;
export const SharedChatsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SharedChats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sharedChats"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SharedChatFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}}]} as unknown as DocumentNode<SharedChatsQuery, SharedChatsQueryVariables>;
export const SharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"share"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SharedChatFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"chat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ChatFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Chat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messages"}}]}}]} as unknown as DocumentNode<SharedChatQuery, SharedChatQueryVariables>;
export const ChatShareOptionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatShareOptions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatShareOptions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"allowedUserIds"}}]}}]}}]} as unknown as DocumentNode<ChatShareOptionsQuery, ChatShareOptionsQueryVariables>;
export const CreateSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateSharedChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SharedChatFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}}]} as unknown as DocumentNode<CreateSharedChatMutation, CreateSharedChatMutationVariables>;
export const UpdateSharedChatAccessDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSharedChatAccess"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"allowedUserIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSharedChatAccess"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}},{"kind":"Argument","name":{"kind":"Name","value":"allowedUserIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"allowedUserIds"}}}]}]}}]} as unknown as DocumentNode<UpdateSharedChatAccessMutation, UpdateSharedChatAccessMutationVariables>;
export const DeleteSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}}]}]}}]} as unknown as DocumentNode<DeleteSharedChatMutation, DeleteSharedChatMutationVariables>;
export const ForkSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ForkSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ForkSharedChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"forkSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}}]}}]}}]} as unknown as DocumentNode<ForkSharedChatMutation, ForkSharedChatMutationVariables>;
export const AskSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AskSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ForkSharedChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"askSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}}]}}]}}]} as unknown as DocumentNode<AskSharedChatMutation, AskSharedChatMutationVariables>;
export const SharedChatQuickQuestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SharedChatQuickQuestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sharedChatQuickQuestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<SharedChatQuickQuestionsQuery, SharedChatQuickQuestionsQueryVariables>;
export const ChatShareMembersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatShareMembers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatShareMembers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}}]} as unknown as DocumentNode<ChatShareMembersQuery, ChatShareMembersQueryVariables>;
export const CurrentClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CurrentClinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentClinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<CurrentClinicQuery, CurrentClinicQueryVariables>;
export const ClinicsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Clinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<ClinicsQuery, ClinicsQueryVariables>;
export const CreateClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateClinic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateClinicInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createClinic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<CreateClinicMutation, CreateClinicMutationVariables>;
export const RenameClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenameClinic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RenameClinicInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renameClinic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<RenameClinicMutation, RenameClinicMutationVariables>;
export const DeleteClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteClinic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteClinic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}]}]}}]} as unknown as DocumentNode<DeleteClinicMutation, DeleteClinicMutationVariables>;
export const SavedPromptsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedPrompts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedPrompts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<SavedPromptsQuery, SavedPromptsQueryVariables>;
export const CreateSavedPromptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSavedPrompt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SavedPromptInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSavedPrompt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CreateSavedPromptMutation, CreateSavedPromptMutationVariables>;
export const UpdateSavedPromptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSavedPrompt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSavedPromptInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSavedPrompt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateSavedPromptMutation, UpdateSavedPromptMutationVariables>;
export const DeleteSavedPromptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSavedPrompt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"promptId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSavedPrompt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"promptId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"promptId"}}}]}]}}]} as unknown as DocumentNode<DeleteSavedPromptMutation, DeleteSavedPromptMutationVariables>;
export const ClinicSavedPromptsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClinicSavedPrompts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicSavedPrompts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ClinicSavedPromptsQuery, ClinicSavedPromptsQueryVariables>;
export const DatabaseObjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DatabaseObjects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"databaseObjects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"database"}},{"kind":"Field","name":{"kind":"Name","value":"schema"}},{"kind":"Field","name":{"kind":"Name","value":"table"}},{"kind":"Field","name":{"kind":"Name","value":"fqdn"}}]}}]}}]} as unknown as DocumentNode<DatabaseObjectsQuery, DatabaseObjectsQueryVariables>;
export const DisplaySettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DisplaySettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displaySettings"}}]}}]} as unknown as DocumentNode<DisplaySettingsQuery, DisplaySettingsQueryVariables>;
export const UpdateDisplaySettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDisplaySettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDisplaySettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateDisplaySettingsMutation, UpdateDisplaySettingsMutationVariables>;
export const EncounterRecordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EncounterRecord"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounterRecord"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterRecordFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"VitalSignsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VitalSigns"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"systolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"diastolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"heartRateBpm"}},{"kind":"Field","name":{"kind":"Name","value":"respiratoryRate"}},{"kind":"Field","name":{"kind":"Name","value":"temperatureC"}},{"kind":"Field","name":{"kind":"Name","value":"spo2Pct"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"heightCm"}},{"kind":"Field","name":{"kind":"Name","value":"bmi"}},{"kind":"Field","name":{"kind":"Name","value":"bloodGlucoseMgDl"}},{"kind":"Field","name":{"kind":"Name","value":"painScore"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"allergen"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"notedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"certNo"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"recommendation"}},{"kind":"Field","name":{"kind":"Name","value":"isFitToWork"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restTo"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"peClassification"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isVoid"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferralFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Referral"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"toExternalDoctor"}},{"kind":"Field","name":{"kind":"Name","value":"toFacility"}},{"kind":"Field","name":{"kind":"Name","value":"referredAt"}},{"kind":"Field","name":{"kind":"Name","value":"toPractitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterDocumentsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"medicalCertificates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"referrals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferralFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}},{"kind":"Field","name":{"kind":"Name","value":"history"}},{"kind":"Field","name":{"kind":"Name","value":"physicalExam"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"patientInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"followUpOn"}},{"kind":"Field","name":{"kind":"Name","value":"disposition"}}]}},{"kind":"Field","name":{"kind":"Name","value":"vitals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"VitalSignsFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allergies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AllergyFields"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterDocumentsFields"}}]}}]} as unknown as DocumentNode<EncounterRecordQuery, EncounterRecordQueryVariables>;
export const PatientOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientOverview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientOverviewFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isFinal"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientOverviewFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientOverview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"visits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}}]}}]}}]} as unknown as DocumentNode<PatientOverviewQuery, PatientOverviewQueryVariables>;
export const PatientAllergiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientAllergies"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientAllergies"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AllergyFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"allergen"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"notedAt"}}]}}]} as unknown as DocumentNode<PatientAllergiesQuery, PatientAllergiesQueryVariables>;
export const SearchIcd10Document = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchIcd10"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchIcd10"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<SearchIcd10Query, SearchIcd10QueryVariables>;
export const PrescriptionPrintDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PrescriptionPrint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}},{"kind":"Field","name":{"kind":"Name","value":"signatory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignatoryFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"dosageForm"}},{"kind":"Field","name":{"kind":"Name","value":"sig"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"isPrn"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"quantityInWords"}},{"kind":"Field","name":{"kind":"Name","value":"dispensedQty"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"rxNo"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isDangerousDrug"}},{"kind":"Field","name":{"kind":"Name","value":"s2FormSerialNo"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignatoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DocumentSignatory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"licenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"facilityName"}},{"kind":"Field","name":{"kind":"Name","value":"facilityAddress"}},{"kind":"Field","name":{"kind":"Name","value":"facilityPhone"}}]}}]} as unknown as DocumentNode<PrescriptionPrintQuery, PrescriptionPrintQueryVariables>;
export const MedicalCertificatePrintDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MedicalCertificatePrint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"medicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}},{"kind":"Field","name":{"kind":"Name","value":"signatory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignatoryFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"certNo"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"documentStatus"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"recommendation"}},{"kind":"Field","name":{"kind":"Name","value":"isFitToWork"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restTo"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"peClassification"}},{"kind":"Field","name":{"kind":"Name","value":"verificationCode"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"isVoid"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignatoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DocumentSignatory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"licenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"facilityName"}},{"kind":"Field","name":{"kind":"Name","value":"facilityAddress"}},{"kind":"Field","name":{"kind":"Name","value":"facilityPhone"}}]}}]} as unknown as DocumentNode<MedicalCertificatePrintQuery, MedicalCertificatePrintQueryVariables>;
export const MyPractitionerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyPractitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myPractitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PractitionerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Practitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"postNominals"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"subspecialty"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNo"}},{"kind":"Field","name":{"kind":"Name","value":"ptrIssuedDate"}},{"kind":"Field","name":{"kind":"Name","value":"ptrIssuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPan"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPanExpiry"}}]}}]} as unknown as DocumentNode<MyPractitionerQuery, MyPractitionerQueryVariables>;
export const SaveMyPractitionerDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveMyPractitioner"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveMyPractitionerInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveMyPractitioner"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PractitionerFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Practitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"postNominals"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"subspecialty"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNo"}},{"kind":"Field","name":{"kind":"Name","value":"ptrIssuedDate"}},{"kind":"Field","name":{"kind":"Name","value":"ptrIssuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseNo"}},{"kind":"Field","name":{"kind":"Name","value":"s2LicenseExpiry"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPan"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPanExpiry"}}]}}]} as unknown as DocumentNode<SaveMyPractitionerMutation, SaveMyPractitionerMutationVariables>;
export const UpdateEncounterNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateEncounterNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateEncounterNoteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateEncounterNote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<UpdateEncounterNoteMutation, UpdateEncounterNoteMutationVariables>;
export const RecordVitalsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordVitals"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordVitalsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordVitals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RecordVitalsMutation, RecordVitalsMutationVariables>;
export const VoidVitalsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidVitals"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidVitals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidVitalsMutation, VoidVitalsMutationVariables>;
export const AddDiagnosisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddDiagnosis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddDiagnosisInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addDiagnosis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AddDiagnosisMutation, AddDiagnosisMutationVariables>;
export const UpdateDiagnosisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDiagnosis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateDiagnosisInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDiagnosis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateDiagnosisMutation, UpdateDiagnosisMutationVariables>;
export const VoidDiagnosisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidDiagnosis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidDiagnosis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidDiagnosisMutation, VoidDiagnosisMutationVariables>;
export const AddAllergyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAllergy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddAllergyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAllergy"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AddAllergyMutation, AddAllergyMutationVariables>;
export const VoidAllergyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidAllergy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidAllergyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidAllergy"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidAllergyMutation, VoidAllergyMutationVariables>;
export const SavePrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SavePrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SavePrescriptionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savePrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SavePrescriptionMutation, SavePrescriptionMutationVariables>;
export const IssuePrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IssuePrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"overrideAllergyWarning"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issuePrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"overrideAllergyWarning"},"value":{"kind":"Variable","name":{"kind":"Name","value":"overrideAllergyWarning"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<IssuePrescriptionMutation, IssuePrescriptionMutationVariables>;
export const VoidPrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidPrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidPrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidPrescriptionMutation, VoidPrescriptionMutationVariables>;
export const SaveMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveMedicalCertificateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SaveMedicalCertificateMutation, SaveMedicalCertificateMutationVariables>;
export const IssueMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IssueMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issueMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<IssueMedicalCertificateMutation, IssueMedicalCertificateMutationVariables>;
export const VoidMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidMedicalCertificateMutation, VoidMedicalCertificateMutationVariables>;
export const EncountersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Encounters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<EncountersQuery, EncountersQueryVariables>;
export const CreateEncounterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateEncounter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateEncounterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createEncounter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<CreateEncounterMutation, CreateEncounterMutationVariables>;
export const ClinicEncountersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClinicEncounters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicEncountersInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicEncounters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<ClinicEncountersQuery, ClinicEncountersQueryVariables>;
export const TransitionEncounterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"TransitionEncounter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TransitionEncounterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"transitionEncounter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"endedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"clinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<TransitionEncounterMutation, TransitionEncounterMutationVariables>;
export const PatientChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}]}]}}]} as unknown as DocumentNode<PatientChatQuery, PatientChatQueryVariables>;
export const MapBoundariesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MapBoundaries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mapBoundaries"}}]}}]} as unknown as DocumentNode<MapBoundariesQuery, MapBoundariesQueryVariables>;
export const ValidateMapBoundaryUrlDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ValidateMapBoundaryUrl"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"url"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"validateMapBoundaryUrl"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"url"},"value":{"kind":"Variable","name":{"kind":"Name","value":"url"}}}]}]}}]} as unknown as DocumentNode<ValidateMapBoundaryUrlMutation, ValidateMapBoundaryUrlMutationVariables>;
export const AddMapBoundaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddMapBoundary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addMapBoundary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<AddMapBoundaryMutation, AddMapBoundaryMutationVariables>;
export const UpdateMapBoundaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMapBoundary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMapBoundary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateMapBoundaryMutation, UpdateMapBoundaryMutationVariables>;
export const DeleteMapBoundaryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMapBoundary"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMapBoundary"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}}]}]}}]} as unknown as DocumentNode<DeleteMapBoundaryMutation, DeleteMapBoundaryMutationVariables>;
export const MemoriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Memories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"memories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MemoryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MemoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Memory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"supersededBy"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<MemoriesQuery, MemoriesQueryVariables>;
export const MemorySettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MemorySettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"memorySettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"memoryEnabled"}}]}}]}}]} as unknown as DocumentNode<MemorySettingsQuery, MemorySettingsQueryVariables>;
export const ClinicMemorySettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClinicMemorySettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicMemorySettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"memoryEnabled"}}]}}]}}]} as unknown as DocumentNode<ClinicMemorySettingsQuery, ClinicMemorySettingsQueryVariables>;
export const SetMemoryEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMemoryEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"memoryEnabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setMemoryEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"memoryEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"memoryEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"memoryEnabled"}}]}}]}}]} as unknown as DocumentNode<SetMemoryEnabledMutation, SetMemoryEnabledMutationVariables>;
export const EditMemoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditMemory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EditMemoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editMemory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MemoryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MemoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Memory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"supersededBy"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<EditMemoryMutation, EditMemoryMutationVariables>;
export const DeleteMemoryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMemory"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"memoryId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMemory"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"memoryId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"memoryId"}}}]}]}}]} as unknown as DocumentNode<DeleteMemoryMutation, DeleteMemoryMutationVariables>;
export const LlmConfigsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LlmConfigs"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"llmConfigs"}}]}}]} as unknown as DocumentNode<LlmConfigsQuery, LlmConfigsQueryVariables>;
export const UpsertLlmConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpsertLlmConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upsertLlmConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpsertLlmConfigMutation, UpsertLlmConfigMutationVariables>;
export const DeleteLlmConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteLlmConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"provider"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteLlmConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"provider"},"value":{"kind":"Variable","name":{"kind":"Name","value":"provider"}}}]}]}}]} as unknown as DocumentNode<DeleteLlmConfigMutation, DeleteLlmConfigMutationVariables>;
export const KnownModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"KnownModels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"knownModels"}}]}}]} as unknown as DocumentNode<KnownModelsQuery, KnownModelsQueryVariables>;
export const DefaultModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DefaultModels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"defaultModels"}}]}}]} as unknown as DocumentNode<DefaultModelsQuery, DefaultModelsQueryVariables>;
export const UpdateDefaultModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDefaultModels"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"settings"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDefaultModels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"settings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"settings"}}}]}]}}]} as unknown as DocumentNode<UpdateDefaultModelsMutation, UpdateDefaultModelsMutationVariables>;
export const DefaultChatModelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DefaultChatModel"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"defaultChatModel"}}]}}]} as unknown as DocumentNode<DefaultChatModelQuery, DefaultChatModelQueryVariables>;
export const AgentSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AgentSettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"agentSettings"}}]}}]} as unknown as DocumentNode<AgentSettingsQuery, AgentSettingsQueryVariables>;
export const UpdateAgentSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateAgentSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateAgentSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateAgentSettingsMutation, UpdateAgentSettingsMutationVariables>;
export const AvailableModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AvailableModels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"availableModels"}}]}}]} as unknown as DocumentNode<AvailableModelsQuery, AvailableModelsQueryVariables>;
export const KnownTranscribeModelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"KnownTranscribeModels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"knownTranscribeModels"}}]}}]} as unknown as DocumentNode<KnownTranscribeModelsQuery, KnownTranscribeModelsQueryVariables>;
export const DiagnosticTestsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiagnosticTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"diagnosticTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticTestFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticTest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"section"}},{"kind":"Field","name":{"kind":"Name","value":"specimenType"}},{"kind":"Field","name":{"kind":"Name","value":"requiresFasting"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"valueType"}},{"kind":"Field","name":{"kind":"Name","value":"options"}},{"kind":"Field","name":{"kind":"Name","value":"refLowMale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighMale"}},{"kind":"Field","name":{"kind":"Name","value":"refLowFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refRangeText"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}}]} as unknown as DocumentNode<DiagnosticTestsQuery, DiagnosticTestsQueryVariables>;
export const EncounterDiagnosticOrdersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EncounterDiagnosticOrders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounterDiagnosticOrders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticOrderFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}},{"kind":"Field","name":{"kind":"Name","value":"specimenCollectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledAt"}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticResultFields"}}]}}]}}]}}]} as unknown as DocumentNode<EncounterDiagnosticOrdersQuery, EncounterDiagnosticOrdersQueryVariables>;
export const LabWorklistDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LabWorklist"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"statuses"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrderStatus"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labWorklist"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"statuses"},"value":{"kind":"Variable","name":{"kind":"Name","value":"statuses"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LabWorklistItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticTest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"section"}},{"kind":"Field","name":{"kind":"Name","value":"specimenType"}},{"kind":"Field","name":{"kind":"Name","value":"requiresFasting"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"valueType"}},{"kind":"Field","name":{"kind":"Name","value":"options"}},{"kind":"Field","name":{"kind":"Name","value":"refLowMale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighMale"}},{"kind":"Field","name":{"kind":"Name","value":"refLowFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refRangeText"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrderSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LabWorklistItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabWorklistItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}},{"kind":"Field","name":{"kind":"Name","value":"specimenCollectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticTestFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticResultFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<LabWorklistQuery, LabWorklistQueryVariables>;
export const LabWorklistCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LabWorklistCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labWorklistCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<LabWorklistCountsQuery, LabWorklistCountsQueryVariables>;
export const CreateDiagnosticOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDiagnosticOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateDiagnosticOrderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createDiagnosticOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticOrderFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}},{"kind":"Field","name":{"kind":"Name","value":"specimenCollectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledAt"}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticResultFields"}}]}}]}}]}}]} as unknown as DocumentNode<CreateDiagnosticOrderMutation, CreateDiagnosticOrderMutationVariables>;
export const CancelDiagnosticOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelDiagnosticOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CancelDiagnosticOrderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelDiagnosticOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<CancelDiagnosticOrderMutation, CancelDiagnosticOrderMutationVariables>;
export const MarkSpecimenCollectedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkSpecimenCollected"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkSpecimenCollectedInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markSpecimenCollected"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}}]}}]}}]} as unknown as DocumentNode<MarkSpecimenCollectedMutation, MarkSpecimenCollectedMutationVariables>;
export const StartDiagnosticOrderItemDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartDiagnosticOrderItem"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticItemStepInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startDiagnosticOrderItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartDiagnosticOrderItemMutation, StartDiagnosticOrderItemMutationVariables>;
export const EnterDiagnosticResultDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EnterDiagnosticResult"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EnterDiagnosticResultInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"enterDiagnosticResult"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LabWorklistItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticTestFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticTest"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"section"}},{"kind":"Field","name":{"kind":"Name","value":"specimenType"}},{"kind":"Field","name":{"kind":"Name","value":"requiresFasting"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}},{"kind":"Field","name":{"kind":"Name","value":"parameters"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"valueType"}},{"kind":"Field","name":{"kind":"Name","value":"options"}},{"kind":"Field","name":{"kind":"Name","value":"refLowMale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighMale"}},{"kind":"Field","name":{"kind":"Name","value":"refLowFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refHighFemale"}},{"kind":"Field","name":{"kind":"Name","value":"refRangeText"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticResultFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"parameterId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticOrderSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"clinicalInfo"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalPhysician"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LabWorklistItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabWorklistItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"accessionNo"}},{"kind":"Field","name":{"kind":"Name","value":"specimenCollectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticTestFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"result"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticResultFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticOrderSummaryFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<EnterDiagnosticResultMutation, EnterDiagnosticResultMutationVariables>;
export const ReleaseDiagnosticResultDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReleaseDiagnosticResult"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticItemStepInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"releaseDiagnosticResult"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<ReleaseDiagnosticResultMutation, ReleaseDiagnosticResultMutationVariables>;
export const MyCareClinicsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyCareClinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myCareClinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"cityMunicipalityCode"}}]}}]}}]} as unknown as DocumentNode<MyCareClinicsQuery, MyCareClinicsQueryVariables>;
export const BarangaysDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Barangays"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cityMunicipalityCode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"barangays"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"cityMunicipalityCode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cityMunicipalityCode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BarangaysQuery, BarangaysQueryVariables>;
export const SearchPatientsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchPatients"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SearchPatientsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchPatients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"barangayCode"}},{"kind":"Field","name":{"kind":"Name","value":"barangayName"}},{"kind":"Field","name":{"kind":"Name","value":"cityMunicipalityName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<SearchPatientsQuery, SearchPatientsQueryVariables>;
export const PatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Patient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"barangayCode"}},{"kind":"Field","name":{"kind":"Name","value":"barangayName"}},{"kind":"Field","name":{"kind":"Name","value":"cityMunicipalityName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<PatientQuery, PatientQueryVariables>;
export const CheckPatientDuplicatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckPatientDuplicates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkPatientDuplicates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientDuplicateFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientDuplicateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDuplicate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"match"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"matchedOn"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"birthYear"}}]}}]} as unknown as DocumentNode<CheckPatientDuplicatesQuery, CheckPatientDuplicatesQueryVariables>;
export const RegisterPatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterPatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterPatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerPatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"duplicates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientDuplicateFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"barangayCode"}},{"kind":"Field","name":{"kind":"Name","value":"barangayName"}},{"kind":"Field","name":{"kind":"Name","value":"cityMunicipalityName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientDuplicateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDuplicate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"match"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"matchedOn"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"birthYear"}}]}}]} as unknown as DocumentNode<RegisterPatientMutation, RegisterPatientMutationVariables>;
export const LinkExistingPatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LinkExistingPatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LinkExistingPatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"linkExistingPatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"suffix"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}},{"kind":"Field","name":{"kind":"Name","value":"barangayCode"}},{"kind":"Field","name":{"kind":"Name","value":"barangayName"}},{"kind":"Field","name":{"kind":"Name","value":"cityMunicipalityName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifications"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"idNumber"}},{"kind":"Field","name":{"kind":"Name","value":"label"}}]}}]}}]} as unknown as DocumentNode<LinkExistingPatientMutation, LinkExistingPatientMutationVariables>;
export const ExportReportPdfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExportReportPdf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportReportPdf"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"data"}}]}}]}}]} as unknown as DocumentNode<ExportReportPdfMutation, ExportReportPdfMutationVariables>;
export const ExportWiseReportPdfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExportWiseReportPdf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportWiseReportPdf"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"data"}}]}}]}}]} as unknown as DocumentNode<ExportWiseReportPdfMutation, ExportWiseReportPdfMutationVariables>;
export const SaveReportToChartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveReportToChart"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveReportToChart"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SaveReportToChartMutation, SaveReportToChartMutationVariables>;
export const SavedReportDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedReportDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedReportDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<SavedReportDocumentQuery, SavedReportDocumentQueryVariables>;
export const MyReportsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyReports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myReports"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"chatTitle"}},{"kind":"Field","name":{"kind":"Name","value":"reportId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"patientName"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<MyReportsQuery, MyReportsQueryVariables>;
export const ResultsToReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ResultsToReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resultsToReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticReportFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticReportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticReport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderItemId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"clinicName"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<ResultsToReviewQuery, ResultsToReviewQueryVariables>;
export const PatientResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticReportFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticReportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticReport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderItemId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"clinicName"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<PatientResultsQuery, PatientResultsQueryVariables>;
export const ReviewResultDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReviewResult"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReviewResultInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reviewResult"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosticReportFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosticReportFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DiagnosticReport"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderItemId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"findings"}},{"kind":"Field","name":{"kind":"Name","value":"impression"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"releasedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"clinicName"}},{"kind":"Field","name":{"kind":"Name","value":"values"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"referenceRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}}]}},{"kind":"Field","name":{"kind":"Name","value":"test"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"loincCode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"order"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"orderNo"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"requestedByName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<ReviewResultMutation, ReviewResultMutationVariables>;
export const SchedulingPractitionersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SchedulingPractitioners"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicPractitioners"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"clinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}}]}}]}}]}}]} as unknown as DocumentNode<SchedulingPractitionersQuery, SchedulingPractitionersQueryVariables>;
export const ClinicAppointmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClinicAppointments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicAppointmentsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicAppointments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AppointmentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEnd"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"reminderSentAt"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledReason"}},{"kind":"Field","name":{"kind":"Name","value":"rescheduledFrom"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"mobileNo"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<ClinicAppointmentsQuery, ClinicAppointmentsQueryVariables>;
export const AppointmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Appointment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appointmentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appointment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appointmentId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AppointmentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEnd"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"reminderSentAt"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledReason"}},{"kind":"Field","name":{"kind":"Name","value":"rescheduledFrom"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"mobileNo"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<AppointmentQuery, AppointmentQueryVariables>;
export const AppointmentSlotsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AppointmentSlots"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AppointmentSlotsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"appointmentSlots"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"start"}},{"kind":"Field","name":{"kind":"Name","value":"end"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<AppointmentSlotsQuery, AppointmentSlotsQueryVariables>;
export const BookAppointmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"BookAppointment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BookAppointmentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bookAppointment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AppointmentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEnd"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"reminderSentAt"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledReason"}},{"kind":"Field","name":{"kind":"Name","value":"rescheduledFrom"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"mobileNo"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<BookAppointmentMutation, BookAppointmentMutationVariables>;
export const RescheduleAppointmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RescheduleAppointment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RescheduleAppointmentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rescheduleAppointment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AppointmentFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AppointmentFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Appointment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"practitionerId"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEnd"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}},{"kind":"Field","name":{"kind":"Name","value":"channel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"reminderSentAt"}},{"kind":"Field","name":{"kind":"Name","value":"cancelledReason"}},{"kind":"Field","name":{"kind":"Name","value":"rescheduledFrom"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"mobileNo"}}]}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<RescheduleAppointmentMutation, RescheduleAppointmentMutationVariables>;
export const CancelAppointmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelAppointment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CancelAppointmentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelAppointment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<CancelAppointmentMutation, CancelAppointmentMutationVariables>;
export const ConfirmAppointmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmAppointment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appointmentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmAppointment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appointmentId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<ConfirmAppointmentMutation, ConfirmAppointmentMutationVariables>;
export const MarkAppointmentNoShowDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkAppointmentNoShow"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"appointmentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markAppointmentNoShow"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"appointmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"appointmentId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<MarkAppointmentNoShowMutation, MarkAppointmentNoShowMutationVariables>;
export const QueueTicketsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"QueueTickets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicketsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"queueTickets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<QueueTicketsQuery, QueueTicketsQueryVariables>;
export const QueueBoardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"QueueBoard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"queueBoard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicName"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"nowServing"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BoardTicketFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"waiting"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BoardTicketFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BoardTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"BoardTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}}]}}]} as unknown as DocumentNode<QueueBoardQuery, QueueBoardQueryVariables>;
export const CheckInPatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CheckInPatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CheckInPatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkInPatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<CheckInPatientMutation, CheckInPatientMutationVariables>;
export const CallNextQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CallNextQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CallNextInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"callNextQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<CallNextQueueTicketMutation, CallNextQueueTicketMutationVariables>;
export const CallQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CallQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"callQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<CallQueueTicketMutation, CallQueueTicketMutationVariables>;
export const StartQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<StartQueueTicketMutation, StartQueueTicketMutationVariables>;
export const SendQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SendQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SendQueueTicketInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sendQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<SendQueueTicketMutation, SendQueueTicketMutationVariables>;
export const CompleteQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<CompleteQueueTicketMutation, CompleteQueueTicketMutationVariables>;
export const SkipQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SkipQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skipQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<SkipQueueTicketMutation, SkipQueueTicketMutationVariables>;
export const RequeueQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RequeueQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"requeueQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"ticketId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ticketId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<RequeueQueueTicketMutation, RequeueQueueTicketMutationVariables>;
export const CancelQueueTicketDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelQueueTicket"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CancelQueueTicketInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelQueueTicket"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"QueueTicketFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SchedulingPractitionerFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SchedulingPractitioner"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"shortName"}},{"kind":"Field","name":{"kind":"Name","value":"roomName"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QueueTicketFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QueueTicket"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"queueDate"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"prefix"}},{"kind":"Field","name":{"kind":"Name","value":"number"}},{"kind":"Field","name":{"kind":"Name","value":"isPriority"}},{"kind":"Field","name":{"kind":"Name","value":"priorityReason"}},{"kind":"Field","name":{"kind":"Name","value":"station"}},{"kind":"Field","name":{"kind":"Name","value":"stationLabel"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"calledAt"}},{"kind":"Field","name":{"kind":"Name","value":"servedAt"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"practitioner"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SchedulingPractitionerFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"encounterNo"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"patientNo"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"appointment"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStart"}},{"kind":"Field","name":{"kind":"Name","value":"visitType"}}]}}]}}]} as unknown as DocumentNode<CancelQueueTicketMutation, CancelQueueTicketMutationVariables>;
export const CompleteSetupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteSetup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteSetupInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeSetup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<CompleteSetupMutation, CompleteSetupMutationVariables>;
export const SkillsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Skills"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skills"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SkillFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SkillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Skill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"}}]}}]} as unknown as DocumentNode<SkillsQuery, SkillsQueryVariables>;
export const SkillCatalogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SkillCatalog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skillCatalog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SkillFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SkillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Skill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"}}]}}]} as unknown as DocumentNode<SkillCatalogQuery, SkillCatalogQueryVariables>;
export const SkillLoadErrorsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SkillLoadErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skillLoadErrors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"location"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<SkillLoadErrorsQuery, SkillLoadErrorsQueryVariables>;
export const SkillSaveStatusDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SkillSaveStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skillSaveStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode<SkillSaveStatusQuery, SkillSaveStatusQueryVariables>;
export const SkillDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SkillDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skillDetail"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"hash"}}]}}]}}]} as unknown as DocumentNode<SkillDetailQuery, SkillDetailQueryVariables>;
export const CreateSkillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSkill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateSkillInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSkill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"location"}}]}}]}}]} as unknown as DocumentNode<CreateSkillMutation, CreateSkillMutationVariables>;
export const UpdateSkillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSkill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSkillInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSkill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"hash"}}]}}]}}]} as unknown as DocumentNode<UpdateSkillMutation, UpdateSkillMutationVariables>;
export const DeleteSkillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSkill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteSkillInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSkill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<DeleteSkillMutation, DeleteSkillMutationVariables>;
export const StorageConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"StorageConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageConfig"}}]}}]} as unknown as DocumentNode<StorageConfigQuery, StorageConfigQueryVariables>;
export const StorageHealthDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"StorageHealth"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageHealth"}}]}}]} as unknown as DocumentNode<StorageHealthQuery, StorageHealthQueryVariables>;
export const StorageUploadLimitsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"StorageUploadLimits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageUploadLimits"}}]}}]} as unknown as DocumentNode<StorageUploadLimitsQuery, StorageUploadLimitsQueryVariables>;
export const StorageUsageDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"StorageUsage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageUsage"}}]}}]} as unknown as DocumentNode<StorageUsageQuery, StorageUsageQueryVariables>;
export const PublicConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicConfig"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loopwiseMode"}},{"kind":"Field","name":{"kind":"Name","value":"enableUserLogin"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"betaAutomationsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"betaContextRecommendationsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"betaStoryFiltersEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"betaSubagentsEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"betaCustomStoriesEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"authProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"google"}},{"kind":"Field","name":{"kind":"Name","value":"github"}},{"kind":"Field","name":{"kind":"Name","value":"gitlab"}},{"kind":"Field","name":{"kind":"Name","value":"smtp"}}]}}]}}]}}]} as unknown as DocumentNode<PublicConfigQuery, PublicConfigQueryVariables>;
export const AppVersionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AppVersion"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"commit"}},{"kind":"Field","name":{"kind":"Name","value":"buildDate"}}]}}]}}]} as unknown as DocumentNode<AppVersionQuery, AppVersionQueryVariables>;
export const CheckUpdateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckUpdate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkUpdate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentVersion"}},{"kind":"Field","name":{"kind":"Name","value":"latestVersion"}},{"kind":"Field","name":{"kind":"Name","value":"updateAvailable"}}]}}]}}]} as unknown as DocumentNode<CheckUpdateQuery, CheckUpdateQueryVariables>;
export const UsageMessagesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsageMessages"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UsageFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usageMessages"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UsageRecordFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsageRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsageRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"messageCount"}},{"kind":"Field","name":{"kind":"Name","value":"webMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"slackMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"teamsMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"telegramMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mattermostMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"discordMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"whatsappMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"adminMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mcpMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"contextRecommendationsMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"inputNoCacheTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheReadTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheWriteTokens"}},{"kind":"Field","name":{"kind":"Name","value":"outputTotalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputNoCacheCost"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheReadCost"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheWriteCost"}},{"kind":"Field","name":{"kind":"Name","value":"outputCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}}]} as unknown as DocumentNode<UsageMessagesQuery, UsageMessagesQueryVariables>;
export const UsageByUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsageByUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UsageFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usageByUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"users"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userName"}},{"kind":"Field","name":{"kind":"Name","value":"messageCount"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}}]}}]}}]} as unknown as DocumentNode<UsageByUserQuery, UsageByUserQueryVariables>;
export const UsageTotalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsageTotal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UsageFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usageTotal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalMessages"}},{"kind":"Field","name":{"kind":"Name","value":"uniqueUsers"}}]}}]}}]} as unknown as DocumentNode<UsageTotalQuery, UsageTotalQueryVariables>;
export const UsageProvidersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsageProviders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usageProviders"}}]}}]} as unknown as DocumentNode<UsageProvidersQuery, UsageProvidersQueryVariables>;
export const UsageUserFacetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsageUserFacets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usageUserFacets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userName"}},{"kind":"Field","name":{"kind":"Name","value":"chatCount"}}]}}]}}]} as unknown as DocumentNode<UsageUserFacetsQuery, UsageUserFacetsQueryVariables>;
export const UsagePeriodSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UsagePeriodSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"usagePeriodSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"selection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UsagePeriodSelectionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"savedPeriods"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SavedUsagePeriodFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsagePeriodSelectionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsagePeriodSelection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"savedPeriodId"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SavedUsagePeriodFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SavedUsagePeriod"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"granularity"}}]}}]} as unknown as DocumentNode<UsagePeriodSettingsQuery, UsagePeriodSettingsQueryVariables>;
export const UpdateUsagePeriodSelectionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUsagePeriodSelection"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"selection"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UsagePeriodSelectionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUsagePeriodSelection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}},{"kind":"Argument","name":{"kind":"Name","value":"selection"},"value":{"kind":"Variable","name":{"kind":"Name","value":"selection"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UsagePeriodSelectionFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsagePeriodSelectionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsagePeriodSelection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"savedPeriodId"}}]}}]} as unknown as DocumentNode<UpdateUsagePeriodSelectionMutation, UpdateUsagePeriodSelectionMutationVariables>;
export const CreateSavedUsagePeriodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSavedUsagePeriod"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"savedPeriod"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SavedUsagePeriodInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSavedUsagePeriod"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}},{"kind":"Argument","name":{"kind":"Name","value":"savedPeriod"},"value":{"kind":"Variable","name":{"kind":"Name","value":"savedPeriod"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SavedUsagePeriodFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SavedUsagePeriodFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SavedUsagePeriod"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"granularity"}}]}}]} as unknown as DocumentNode<CreateSavedUsagePeriodMutation, CreateSavedUsagePeriodMutationVariables>;
export const UpdateSavedUsagePeriodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSavedUsagePeriod"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"savedPeriod"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSavedUsagePeriodInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSavedUsagePeriod"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}},{"kind":"Argument","name":{"kind":"Name","value":"savedPeriod"},"value":{"kind":"Variable","name":{"kind":"Name","value":"savedPeriod"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SavedUsagePeriodFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SavedUsagePeriodFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SavedUsagePeriod"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"granularity"}}]}}]} as unknown as DocumentNode<UpdateSavedUsagePeriodMutation, UpdateSavedUsagePeriodMutationVariables>;
export const DeleteSavedUsagePeriodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSavedUsagePeriod"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSavedUsagePeriod"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"selection"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UsagePeriodSelectionFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsagePeriodSelectionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsagePeriodSelection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"savedPeriodId"}}]}}]} as unknown as DocumentNode<DeleteSavedUsagePeriodMutation, DeleteSavedUsagePeriodMutationVariables>;
export const CurrentOrgRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CurrentOrgRole"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentOrgRole"}}]}}]} as unknown as DocumentNode<CurrentOrgRoleQuery, CurrentOrgRoleQueryVariables>;
export const ManagedUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ManagedUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"managedUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<ManagedUsersQuery, ManagedUsersQueryVariables>;
export const CreateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<CreateUserMutation, CreateUserMutationVariables>;
export const CreatePasswordLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePasswordLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPasswordLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<CreatePasswordLinkMutation, CreatePasswordLinkMutationVariables>;
export const UpdateUserRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserRoleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserRole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<UpdateUserRoleMutation, UpdateUserRoleMutationVariables>;
export const SetUserStaffRolesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetUserStaffRoles"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetUserStaffRolesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setUserStaffRoles"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<SetUserStaffRolesMutation, SetUserStaffRolesMutationVariables>;
export const SetUserActiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetUserActive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"active"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setUserActive"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"active"},"value":{"kind":"Variable","name":{"kind":"Name","value":"active"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"staffRoles"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<SetUserActiveMutation, SetUserActiveMutationVariables>;
export const PasswordLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PasswordLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"passwordLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"isInvite"}}]}}]}}]} as unknown as DocumentNode<PasswordLinkQuery, PasswordLinkQueryVariables>;
export const SetPasswordWithLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetPasswordWithLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetPasswordWithLinkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setPasswordWithLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<SetPasswordWithLinkMutation, SetPasswordWithLinkMutationVariables>;
export const HasUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"HasUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasUsers"}}]}}]} as unknown as DocumentNode<HasUsersQuery, HasUsersQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"requiresPasswordReset"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const UpdateProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateProfileMutation, UpdateProfileMutationVariables>;
export const ModifyPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifyPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ModifyPasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifyPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ModifyPasswordMutation, ModifyPasswordMutationVariables>;
export const UserPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPreferences"}}]}}]} as unknown as DocumentNode<UserPreferencesQuery, UserPreferencesQueryVariables>;
export const UpdateUserPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserPreferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserPreferencesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserPreferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateUserPreferencesMutation, UpdateUserPreferencesMutationVariables>;
export const ChangePasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangePassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChangePasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changePassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ChangePasswordMutation, ChangePasswordMutationVariables>;
export const WiseIssuePrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseIssuePrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issuePrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseIssuePrescriptionMutation, WiseIssuePrescriptionMutationVariables>;
export const WiseIssueMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseIssueMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issueMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseIssueMedicalCertificateMutation, WiseIssueMedicalCertificateMutationVariables>;
export const WiseSaveReportToChartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseSaveReportToChart"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveReportToChart"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseSaveReportToChartMutation, WiseSaveReportToChartMutationVariables>;
export const UpdatePatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdatePatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}}]}}]}}]}}]} as unknown as DocumentNode<UpdatePatientMutation, UpdatePatientMutationVariables>;
export const WisePatientContactDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WisePatientContact"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}},{"kind":"Field","name":{"kind":"Name","value":"address"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addressLine"}}]}}]}}]}}]} as unknown as DocumentNode<WisePatientContactQuery, WisePatientContactQueryVariables>;
export const WiseProposalOutcomesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WiseProposalOutcomes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wiseProposalOutcomes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WiseProposalOutcomeFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WiseProposalOutcomeFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WiseProposalOutcome"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"toolName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}}]}}]} as unknown as DocumentNode<WiseProposalOutcomesQuery, WiseProposalOutcomesQueryVariables>;
export const CancelWiseProposalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelWiseProposal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelWiseProposal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WiseProposalOutcomeFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WiseProposalOutcomeFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WiseProposalOutcome"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"toolName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}}]}}]} as unknown as DocumentNode<CancelWiseProposalMutation, CancelWiseProposalMutationVariables>;
export const WiseToolSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WiseToolSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"organizationId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wiseToolSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"organizationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"organizationId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"organizationId"}},{"kind":"Field","name":{"kind":"Name","value":"organizations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isAdmin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tools"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"locked"}},{"kind":"Field","name":{"kind":"Name","value":"comingSoon"}},{"kind":"Field","name":{"kind":"Name","value":"organizationDefault"}},{"kind":"Field","name":{"kind":"Name","value":"organizationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"myEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}}]}}]}}]} as unknown as DocumentNode<WiseToolSettingsQuery, WiseToolSettingsQueryVariables>;
export const SetWiseToolEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetWiseToolEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"organizationId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setWiseToolEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"organizationId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"organizationId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}]}]}}]} as unknown as DocumentNode<SetWiseToolEnabledMutation, SetWiseToolEnabledMutationVariables>;
export const SetMyWiseToolEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMyWiseToolEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setMyWiseToolEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}]}]}}]} as unknown as DocumentNode<SetMyWiseToolEnabledMutation, SetMyWiseToolEnabledMutationVariables>;