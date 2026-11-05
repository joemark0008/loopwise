/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AddAllergyInput = {
  /** The facility recording it (`myFacilities`). */
  facilityId: string | number;
  kind?: AllergyKind | null | undefined;
  patientId: string | number;
  reaction?: string | null | undefined;
  severity?: AllergySeverity | null | undefined;
  substance: string;
  /** Set by a Wise card (`propose_allergy`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type AddDiagnosisInput = {
  certainty?: DiagnosisCertainty | null | undefined;
  /** The diagnosis as written, normally the ICD-10 title. */
  display: string;
  encounterId: string | number;
  /** ICD-10 (WHO 2010), e.g. `I10` or `E11.9`. */
  icd10Code: string;
  /** Makes it the primary diagnosis (the previous one stops being). */
  isPrimary?: boolean | null | undefined;
  notes?: string | null | undefined;
  /** Set when completing a confirmed `propose_encounter` card (its drafted vitals and diagnoses). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type AllergyKind =
  | 'drug'
  | 'environment'
  | 'food'
  | 'other';

export type AllergySeverity =
  | 'mild'
  | 'moderate'
  | 'severe';

/** The 20% senior citizen / PWD discount. */
export type BillDiscountKind =
  | 'pwd'
  | 'senior_citizen';

/** Draft (editable), finalized (locked), paid, voided. */
export type BillStatus =
  | 'draft'
  | 'finalized'
  | 'paid'
  | 'voided';

export type CaseState =
  | 'accepted'
  | 'acknowledged'
  | 'closed'
  | 'confirming'
  | 'escalated'
  | 'lost_to_follow_up'
  | 'notified'
  | 'open'
  | 'referred'
  | 'seen'
  | 'treatment_started';

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChargeInput = {
  code?: string | null | undefined;
  description: string;
  kind: ChargeKind;
  quantity: number;
  /** Pesos. */
  unitPrice: number;
};

export type ChargeKind =
  | 'consultation'
  | 'imaging'
  | 'laboratory'
  | 'medicine'
  | 'other'
  | 'procedure'
  | 'supply';

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

export type CompleteSetupInput = {
  email: string;
  name: string;
  password: string;
  token: string;
};

export type CreateClinicInput = {
  name: string;
};

export type CreateEncounterInput = {
  /** The facility of the visit (`myFacilities`). */
  facilityId: string | number;
  notes?: string | null | undefined;
  patientId: string | number;
  reason: string;
  /** The patient's chart chat, when Wise drafted the encounter. */
  sourceChatId?: string | number | null | undefined;
  /** ISO 8601; now when left out. */
  startedAt?: string | null | undefined;
  /** Set by the Wise card (`propose_encounter`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** A test ordered from an encounter, sent to a lab or imaging facility. */
export type CreateEncounterOrderInput = {
  /** LOINC code from the test list (`orderableTests`). */
  code: string;
  encounterId: string | number;
  notes?: string | null | undefined;
  priority?: OrderPriority | null | undefined;
  /** The lab, imaging center or hospital (`orderTargets`). */
  targetOrgId: string | number;
};

/** Several tests ordered from one encounter, sent to one facility, in one transaction. */
export type CreateEncounterOrdersInput = {
  /** LOINC codes from the test list (`orderableTests`). */
  codes: Array<string>;
  encounterId: string | number;
  notes?: string | null | undefined;
  priority?: OrderPriority | null | undefined;
  /** The lab, imaging center or hospital (`orderTargets`). */
  targetOrgId: string | number;
  /** Set by a Wise card (`propose_order`). */
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
  /** admin, user or viewer. */
  role: string;
};

export type DeleteSkillInput = {
  expectedHash: string;
  name: string;
};

export type DiagnosisCertainty =
  | 'confirmed'
  | 'provisional';

/** Draft (editable), issued (locked), voided. */
export type DocumentStatus =
  | 'draft'
  | 'issued'
  | 'voided';

export type DuplicateMatch =
  | 'EXACT_IDENTIFIER'
  | 'NAME_BIRTH_SEX';

export type EditMemoryInput = {
  content: string;
  memoryId: string | number;
};

export type EvidenceType =
  | 'dispense'
  | 'result'
  | 'signoff'
  | 'visit_note';

export type ForkSharedChatInput = {
  selection?: SelectionInput | null | undefined;
  shareId: string | number;
};

/** Use an existing patient that `checkPatientDuplicates` matched, instead of a new one. */
export type LinkExistingPatientInput = {
  /** YYYY-MM-DD. */
  birthDate: string;
  consentGiven: boolean;
  /** The facility registering the patient (`myFacilities`). */
  facilityId: string | number;
  familyName: string;
  givenName: string;
  mrn?: string | null | undefined;
  patientId: string | number;
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

export type MarkBillPaidInput = {
  id: string | number;
  /** Official receipt number. */
  orNumber: string;
  /** Set by a Wise card (`propose_bill_step`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type MedicationRoute =
  | 'inhalation'
  | 'intramuscular'
  | 'intravenous'
  | 'nasal'
  | 'ophthalmic'
  | 'oral'
  | 'other'
  | 'otic'
  | 'rectal'
  | 'subcutaneous'
  | 'sublingual'
  | 'topical'
  | 'vaginal';

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
  | 'routine'
  | 'stat'
  | 'urgent';

/** Rejecting or cancelling an order: the reason the other side sees. */
export type OrderReasonInput = {
  orderId: string | number;
  reason: string;
  /** Set by a Wise card (`propose_lab_order_step`, `propose_cancel_order`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type OrderStatus =
  | 'accepted'
  | 'cancelled'
  | 'collected'
  | 'draft'
  | 'rejected'
  | 'resulted'
  | 'reviewed'
  | 'sent';

export type PatientDraftInput = {
  /** YYYY-MM-DD. */
  birthDate: string;
  /** The facility registering the patient (`myFacilities`). */
  facilityId: string | number;
  familyName: string;
  givenName: string;
  mrn?: string | null | undefined;
  philHealthId?: string | null | undefined;
  phone?: string | null | undefined;
  preferredLanguage?: string | null | undefined;
  sex: Sex;
};

export type PrescriptionItemInput = {
  brandName?: string | null | undefined;
  dose: string;
  durationDays?: number | null | undefined;
  form?: string | null | undefined;
  frequency: string;
  genericName: string;
  instructions?: string | null | undefined;
  quantity: number;
  quantityUnit?: string | null | undefined;
  refills?: number | null | undefined;
  route?: MedicationRoute | null | undefined;
  strength?: string | null | undefined;
};

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

export type RegisterPatientInput = {
  /** Register although a patient with the same name, birth date and sex exists (never for an identifier match). */
  acknowledgeDuplicates?: boolean;
  /** YYYY-MM-DD. */
  birthDate: string;
  /** The patient agreed to be registered; sets `consentAt`. Registration needs it. */
  consentGiven: boolean;
  /** The facility registering the patient (`myFacilities`). */
  facilityId: string | number;
  familyName: string;
  givenName: string;
  mrn?: string | null | undefined;
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

export type ResultClassification =
  | 'actionable'
  | 'critical'
  | 'normal';

export type ResultFlag =
  | 'abnormal'
  | 'critical_high'
  | 'critical_low'
  | 'high'
  | 'low'
  | 'normal';

export type ResultUrgency =
  | 'abnormal'
  | 'critical'
  | 'normal'
  | 'unflagged';

export type ReviewResultInput = {
  /** The reviewer's note, kept in the audit row. */
  note?: string | null | undefined;
  resultId: string | number;
  /** Set by a Wise card (`propose_result_review`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SaveEncounterBillInput = {
  charges: Array<ChargeInput>;
  discountKind?: BillDiscountKind | null | undefined;
  encounterId: string | number;
  /** The bill's `version` the draft was made from; refused with CONFLICT if it changed since. */
  expectedVersion?: number | null | undefined;
  /** Pesos PhilHealth covers. */
  philhealthCoverage?: number | null | undefined;
  philhealthPackageCode?: string | null | undefined;
  /** Set by the Wise card (`propose_charges`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SaveMedicalCertificateInput = {
  diagnosisText: string;
  encounterId: string | number;
  /** YYYY-MM-DD. */
  examinedOn: string;
  /** The certificate's `version` the draft was made from; refused with CONFLICT if it changed since. */
  expectedVersion?: number | null | undefined;
  fitness?: WorkFitness | null | undefined;
  /** The draft to replace; a new draft when left out. */
  id?: string | number | null | undefined;
  purpose?: string | null | undefined;
  remarks?: string | null | undefined;
  restDays?: number | null | undefined;
  /** YYYY-MM-DD. */
  restFrom?: string | null | undefined;
  /** Set by the Wise card (`propose_medical_certificate`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type SavePrescriptionInput = {
  encounterId: string | number;
  /** The prescription's `version` the draft was made from; refused with CONFLICT if it changed since. */
  expectedVersion?: number | null | undefined;
  /** The draft to replace; a new draft when left out. */
  id?: string | number | null | undefined;
  items: Array<PrescriptionItemInput>;
  notes?: string | null | undefined;
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
  /** Name words, or an exact MRN / PhilHealth number. */
  query?: string | null | undefined;
};

export type SelectionInput = {
  end: number;
  start: number;
  text: string;
};

export type SetPasswordWithLinkInput = {
  password: string;
  token: string;
};

export type Sex =
  | 'female'
  | 'male'
  | 'other'
  | 'unknown';

export type UpdateClinicianProfileInput = {
  /** e.g. "MD". */
  credentials?: string | null | undefined;
  /** PRC license number. */
  prcLicenseNumber?: string | null | undefined;
  /** Professional tax receipt number. */
  ptrNumber?: string | null | undefined;
  specialty?: string | null | undefined;
};

export type UpdateDiagnosisInput = {
  certainty?: DiagnosisCertainty | null | undefined;
  id: string | number;
  isPrimary?: boolean | null | undefined;
  notes?: string | null | undefined;
  /** Set by a Wise card (`propose_diagnosis`). */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

export type UpdateEncounterNoteInput = {
  assessment?: string | null | undefined;
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

/** Changes a patient's contact details; names, birth date, sex and identifiers stay. */
export type UpdatePatientInput = {
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
  /** admin, user or viewer. */
  role: string;
  userId: string | number;
};

export type Urgency =
  | 'critical'
  | 'routine'
  | 'soon'
  | 'urgent';

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

/** Voids an allergy recorded in error; it stays in the record, struck through. */
export type VoidAllergyInput = {
  id: string | number;
  reason: string;
  /** Set by a Wise card (`propose_void_*`, `propose_bill_step`): verified and settled with the void. */
  wiseOrigin?: WiseOriginInput | null | undefined;
};

/** Voids a record entry entered in error; it stays in the record, struck through. */
export type VoidEntryInput = {
  id: string | number;
  reason: string;
  /** Set by a Wise card (`propose_void_*`, `propose_bill_step`): verified and settled with the void. */
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

export type WorkFitness =
  | 'fit_to_work'
  | 'fit_with_restrictions'
  | 'unfit';

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

export type ChatFieldsFragment = { id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, forkMetadata: unknown, automationRun: unknown, messages: Array<unknown> };

export type SharedChatFieldsFragment = { id: string, chatId: string, clinicId: string, userId: string, visibility: string, createdAt: string, authorName: string, title: string, forkMetadata: unknown, messageBubbles: Array<{ role: string, charCount: number }> | null };

export type ChatQueryVariables = Exact<{
  chatId: string | number;
}>;


export type ChatQuery = { chat: { id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, forkMetadata: unknown, automationRun: unknown, messages: Array<unknown> } };

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


export type SharedChatQuery = { sharedChat: { userRole: string | null, share: { id: string, chatId: string, clinicId: string, userId: string, visibility: string, createdAt: string, authorName: string, title: string, forkMetadata: unknown, messageBubbles: Array<{ role: string, charCount: number }> | null }, chat: { id: string, clinicId: string, title: string, isStarred: boolean, isOnboarding: boolean, createdAt: number, updatedAt: number, forkMetadata: unknown, automationRun: unknown, messages: Array<unknown> } } };

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

export type ClinicSummaryFieldsFragment = { id: string, name: string, type: string, path: string | null, orgId: string | null, userRole: string, createdAt: string, updatedAt: string };

export type CurrentClinicQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentClinicQuery = { currentClinic: { id: string, name: string, type: string, path: string | null, orgId: string | null, userRole: string, createdAt: string, updatedAt: string } | null };

export type ClinicsQueryVariables = Exact<{ [key: string]: never; }>;


export type ClinicsQuery = { clinics: Array<{ id: string, name: string, type: string, path: string | null, orgId: string | null, userRole: string, createdAt: string, updatedAt: string }> };

export type CreateClinicMutationVariables = Exact<{
  input: CreateClinicInput;
}>;


export type CreateClinicMutation = { createClinic: { id: string, name: string, type: string, path: string | null, orgId: string | null, userRole: string, createdAt: string, updatedAt: string } };

export type RenameClinicMutationVariables = Exact<{
  input: RenameClinicInput;
}>;


export type RenameClinicMutation = { renameClinic: { id: string, name: string, type: string, path: string | null, orgId: string | null, userRole: string, createdAt: string, updatedAt: string } };

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

export type DiagnosisFieldsFragment = { id: string, icd10Code: string, display: string, certainty: DiagnosisCertainty, isPrimary: boolean, notes: string | null, voidedAt: string | null, voidReason: string | null };

export type AllergyFieldsFragment = { id: string, substance: string, kind: AllergyKind, reaction: string | null, severity: AllergySeverity | null };

export type OrderFieldsFragment = { id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, closedAt: string | null, statusReason: string | null, createdAt: string, targetFacility: { id: string, name: string } | null, results: Array<{ id: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, resultedAt: string, reviewedAt: string | null }> };

export type PrescriptionItemFieldsFragment = { id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null };

export type PrescriptionFieldsFragment = { id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, rxNumber: string | null, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null }> };

export type MedicalCertificateFieldsFragment = { id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, certificateNumber: string | null, examinedOn: string, diagnosisText: string, fitness: WorkFitness, restFrom: string | null, restDays: number | null, remarks: string | null, purpose: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string };

export type SignatoryFieldsFragment = { name: string, credentials: string | null, licenseNumber: string | null, ptrNumber: string | null, facilityName: string, facilityAddress: string | null, facilityPhone: string | null };

export type EncounterBillFieldsFragment = { id: string, version: number, encounterId: string, status: BillStatus, subtotal: number, discountKind: BillDiscountKind | null, discountAmount: number, philhealthPackageCode: string | null, philhealthCoverage: number, total: number, finalizedAt: string | null, paidAt: string | null, orNumber: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, charges: Array<{ id: string, position: number, kind: ChargeKind, description: string, code: string | null, quantity: number, unitPrice: number, amount: number }> };

export type EncounterRecordFieldsFragment = { canEdit: boolean, encounter: { history: string | null, physicalExam: string | null, assessment: string | null, plan: string | null, patientInstructions: string | null, followUpOn: string | null, id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null }, vitals: Array<{ id: string, systolicMmHg: number | null, diastolicMmHg: number | null, heartRateBpm: number | null, respiratoryRate: number | null, temperatureC: number | null, spo2Pct: number | null, weightKg: number | null, heightCm: number | null, bmi: number | null, bloodGlucoseMgDl: number | null, painScore: number | null, recordedAt: string, voidedAt: string | null, voidReason: string | null }>, diagnoses: Array<{ id: string, icd10Code: string, display: string, certainty: DiagnosisCertainty, isPrimary: boolean, notes: string | null, voidedAt: string | null, voidReason: string | null }>, allergies: Array<{ id: string, substance: string, kind: AllergyKind, reaction: string | null, severity: AllergySeverity | null }>, orders: Array<{ id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, closedAt: string | null, statusReason: string | null, createdAt: string, targetFacility: { id: string, name: string } | null, results: Array<{ id: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, resultedAt: string, reviewedAt: string | null }> }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, rxNumber: string | null, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null }> }>, medicalCertificates: Array<{ id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, certificateNumber: string | null, examinedOn: string, diagnosisText: string, fitness: WorkFitness, restFrom: string | null, restDays: number | null, remarks: string | null, purpose: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string }>, bills: Array<{ id: string, version: number, encounterId: string, status: BillStatus, subtotal: number, discountKind: BillDiscountKind | null, discountAmount: number, philhealthPackageCode: string | null, philhealthCoverage: number, total: number, finalizedAt: string | null, paidAt: string | null, orNumber: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, charges: Array<{ id: string, position: number, kind: ChargeKind, description: string, code: string | null, quantity: number, unitPrice: number, amount: number }> }> };

export type EncounterRecordQueryVariables = Exact<{
  encounterId: string | number;
}>;


export type EncounterRecordQuery = { encounterRecord: { canEdit: boolean, encounter: { history: string | null, physicalExam: string | null, assessment: string | null, plan: string | null, patientInstructions: string | null, followUpOn: string | null, id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null }, vitals: Array<{ id: string, systolicMmHg: number | null, diastolicMmHg: number | null, heartRateBpm: number | null, respiratoryRate: number | null, temperatureC: number | null, spo2Pct: number | null, weightKg: number | null, heightCm: number | null, bmi: number | null, bloodGlucoseMgDl: number | null, painScore: number | null, recordedAt: string, voidedAt: string | null, voidReason: string | null }>, diagnoses: Array<{ id: string, icd10Code: string, display: string, certainty: DiagnosisCertainty, isPrimary: boolean, notes: string | null, voidedAt: string | null, voidReason: string | null }>, allergies: Array<{ id: string, substance: string, kind: AllergyKind, reaction: string | null, severity: AllergySeverity | null }>, orders: Array<{ id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, closedAt: string | null, statusReason: string | null, createdAt: string, targetFacility: { id: string, name: string } | null, results: Array<{ id: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, resultedAt: string, reviewedAt: string | null }> }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, rxNumber: string | null, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null }> }>, medicalCertificates: Array<{ id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, certificateNumber: string | null, examinedOn: string, diagnosisText: string, fitness: WorkFitness, restFrom: string | null, restDays: number | null, remarks: string | null, purpose: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string }>, bills: Array<{ id: string, version: number, encounterId: string, status: BillStatus, subtotal: number, discountKind: BillDiscountKind | null, discountAmount: number, philhealthPackageCode: string | null, philhealthCoverage: number, total: number, finalizedAt: string | null, paidAt: string | null, orNumber: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, charges: Array<{ id: string, position: number, kind: ChargeKind, description: string, code: string | null, quantity: number, unitPrice: number, amount: number }> }> } | null };

export type PatientOverviewFieldsFragment = { visits: Array<{ billStatus: BillStatus | null, encounter: { id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null }, diagnoses: Array<{ id: string, icd10Code: string, display: string, certainty: DiagnosisCertainty, isPrimary: boolean, notes: string | null, voidedAt: string | null, voidReason: string | null }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, rxNumber: string | null, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null }> }>, orders: Array<{ id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, closedAt: string | null, statusReason: string | null, createdAt: string, targetFacility: { id: string, name: string } | null, results: Array<{ id: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, resultedAt: string, reviewedAt: string | null }> }> }> };

export type PatientOverviewQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientOverviewQuery = { patientOverview: { visits: Array<{ billStatus: BillStatus | null, encounter: { id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null }, diagnoses: Array<{ id: string, icd10Code: string, display: string, certainty: DiagnosisCertainty, isPrimary: boolean, notes: string | null, voidedAt: string | null, voidReason: string | null }>, prescriptions: Array<{ id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, rxNumber: string | null, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, items: Array<{ id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null }> }>, orders: Array<{ id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, closedAt: string | null, statusReason: string | null, createdAt: string, targetFacility: { id: string, name: string } | null, results: Array<{ id: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, resultedAt: string, reviewedAt: string | null }> }> }> } };

export type PatientAllergiesQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientAllergiesQuery = { patientAllergies: Array<{ id: string, substance: string, kind: AllergyKind, reaction: string | null, severity: AllergySeverity | null }> };

export type SearchIcd10QueryVariables = Exact<{
  query: string;
}>;


export type SearchIcd10Query = { searchIcd10: Array<{ code: string, title: string }> };

export type OrderOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type OrderOptionsQuery = { orderableTests: Array<{ code: string, display: string, kind: string }>, orderTargets: Array<{ id: string, name: string }> };

export type PrescriptionPrintQueryVariables = Exact<{
  id: string | number;
}>;


export type PrescriptionPrintQuery = { prescription: { id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, rxNumber: string | null, notes: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, signatory: { name: string, credentials: string | null, licenseNumber: string | null, ptrNumber: string | null, facilityName: string, facilityAddress: string | null, facilityPhone: string | null } | null, items: Array<{ id: string, position: number, genericName: string, brandName: string | null, strength: string | null, form: string | null, dose: string, route: MedicationRoute, frequency: string, durationDays: number | null, quantity: number, quantityUnit: string | null, refills: number, instructions: string | null }> } | null };

export type MedicalCertificatePrintQueryVariables = Exact<{
  id: string | number;
}>;


export type MedicalCertificatePrintQuery = { medicalCertificate: { id: string, version: number, encounterId: string, patientId: string, status: DocumentStatus, certificateNumber: string | null, examinedOn: string, diagnosisText: string, fitness: WorkFitness, restFrom: string | null, restDays: number | null, remarks: string | null, purpose: string | null, issuedAt: string | null, voidedAt: string | null, voidReason: string | null, createdAt: string, signatory: { name: string, credentials: string | null, licenseNumber: string | null, ptrNumber: string | null, facilityName: string, facilityAddress: string | null, facilityPhone: string | null } | null } | null };

export type MyClinicianProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type MyClinicianProfileQuery = { myClinicianProfile: { credentials: string | null, specialty: string | null, prcLicenseNumber: string | null, ptrNumber: string | null } };

export type UpdateMyClinicianProfileMutationVariables = Exact<{
  input: UpdateClinicianProfileInput;
}>;


export type UpdateMyClinicianProfileMutation = { updateMyClinicianProfile: { credentials: string | null, specialty: string | null, prcLicenseNumber: string | null, ptrNumber: string | null } };

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

export type CreateEncounterOrderMutationVariables = Exact<{
  input: CreateEncounterOrderInput;
}>;


export type CreateEncounterOrderMutation = { createEncounterOrder: { id: string } };

export type SavePrescriptionMutationVariables = Exact<{
  input: SavePrescriptionInput;
}>;


export type SavePrescriptionMutation = { savePrescription: { id: string } };

export type IssuePrescriptionMutationVariables = Exact<{
  id: string | number;
  overrideAllergyWarning?: boolean | null | undefined;
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
}>;


export type IssueMedicalCertificateMutation = { issueMedicalCertificate: { id: string } };

export type VoidMedicalCertificateMutationVariables = Exact<{
  input: VoidEntryInput;
}>;


export type VoidMedicalCertificateMutation = { voidMedicalCertificate: { id: string } };

export type SaveEncounterBillMutationVariables = Exact<{
  input: SaveEncounterBillInput;
}>;


export type SaveEncounterBillMutation = { saveEncounterBill: { id: string } };

export type FinalizeEncounterBillMutationVariables = Exact<{
  id: string | number;
}>;


export type FinalizeEncounterBillMutation = { finalizeEncounterBill: { id: string } };

export type MarkEncounterBillPaidMutationVariables = Exact<{
  input: MarkBillPaidInput;
}>;


export type MarkEncounterBillPaidMutation = { markEncounterBillPaid: { id: string } };

export type VoidEncounterBillMutationVariables = Exact<{
  input: VoidEntryInput;
}>;


export type VoidEncounterBillMutation = { voidEncounterBill: { id: string } };

export type CreateEncounterOrdersMutationVariables = Exact<{
  input: CreateEncounterOrdersInput;
}>;


export type CreateEncounterOrdersMutation = { createEncounterOrders: Array<{ id: string, code: string, display: string | null }> };

export type EncounterFieldsFragment = { id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null };

export type EncountersQueryVariables = Exact<{
  patientId: string | number;
}>;


export type EncountersQuery = { encounters: Array<{ id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null }> };

export type CreateEncounterMutationVariables = Exact<{
  input: CreateEncounterInput;
}>;


export type CreateEncounterMutation = { createEncounter: { id: string, patientId: string, reason: string | null, notes: string | null, startedAt: string, sourceChatId: string | null, facility: { id: string, name: string } | null, doctor: { id: string, name: string } | null } };

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

export type LabOrderFieldsFragment = { id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, createdAt: string, orderingDoctorName: string, orderingFacilityName: string, patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: string } };

export type LabOrdersQueryVariables = Exact<{
  status: OrderStatus;
}>;


export type LabOrdersQuery = { labOrders: Array<{ id: string, code: string, display: string | null, priority: OrderPriority, status: OrderStatus, notes: string | null, sentAt: string | null, acceptedAt: string | null, collectedAt: string | null, resultedAt: string | null, createdAt: string, orderingDoctorName: string, orderingFacilityName: string, patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: string } }> };

export type LabOrderCountsQueryVariables = Exact<{ [key: string]: never; }>;


export type LabOrderCountsQuery = { labOrderCounts: Array<{ status: OrderStatus, count: number }> };

export type AcceptOrderMutationVariables = Exact<{
  orderId: string | number;
}>;


export type AcceptOrderMutation = { acceptOrder: { id: string, status: OrderStatus } };

export type MarkOrderCollectedMutationVariables = Exact<{
  orderId: string | number;
}>;


export type MarkOrderCollectedMutation = { markOrderCollected: { id: string, status: OrderStatus } };

export type RejectOrderMutationVariables = Exact<{
  input: OrderReasonInput;
}>;


export type RejectOrderMutation = { rejectOrder: { id: string, status: OrderStatus } };

export type CancelOrderMutationVariables = Exact<{
  input: OrderReasonInput;
}>;


export type CancelOrderMutation = { cancelOrder: { id: string, status: OrderStatus } };

export type PathwayFieldsFragment = { key: string, name: string, version: number, source: string, resultReviewHours: number, criticalAlertHours: number, criticalFlagNextState: CaseState, closureEvidence: Array<EvidenceType>, closureDescription: string, steps: Array<{ state: CaseState, label: string, slaHours: number | null }>, triggers: Array<{ code: string, codeSystem: string, display: string, type: string, unit: string | null, conversions: Array<{ from: Array<string>, factor: number, offset: number, note: string | null }>, bands: Array<{ label: string, classification: ResultClassification, urgency: Urgency, reason: string, guideline: string, nextState: CaseState, slaHours: number | null }> }> };

export type PathwaysQueryVariables = Exact<{ [key: string]: never; }>;


export type PathwaysQuery = { pathways: Array<{ key: string, name: string, version: number, source: string, resultReviewHours: number, criticalAlertHours: number, criticalFlagNextState: CaseState, closureEvidence: Array<EvidenceType>, closureDescription: string, steps: Array<{ state: CaseState, label: string, slaHours: number | null }>, triggers: Array<{ code: string, codeSystem: string, display: string, type: string, unit: string | null, conversions: Array<{ from: Array<string>, factor: number, offset: number, note: string | null }>, bands: Array<{ label: string, classification: ResultClassification, urgency: Urgency, reason: string, guideline: string, nextState: CaseState, slaHours: number | null }> }> }> };

export type ResultEvaluationFieldsFragment = { id: string, resultId: string, pathwayKey: string, pathwayName: string, ruleVersion: number, classification: ResultClassification, urgency: Urgency, reason: string, guideline: string, nextState: CaseState, slaHours: number | null, basis: string, evaluatedAt: string, rule: { code: string, display: string, band: string | null, comparedValue: number | null, comparedUnit: string | null, received: string } };

export type ResultEvaluationQueryVariables = Exact<{
  resultId: string | number;
}>;


export type ResultEvaluationQuery = { resultEvaluation: { id: string, resultId: string, pathwayKey: string, pathwayName: string, ruleVersion: number, classification: ResultClassification, urgency: Urgency, reason: string, guideline: string, nextState: CaseState, slaHours: number | null, basis: string, evaluatedAt: string, rule: { code: string, display: string, band: string | null, comparedValue: number | null, comparedUnit: string | null, received: string } } | null };

export type PatientFieldsFragment = { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex, phone: string | null, preferredLanguage: string, consentAt: string | null, createdAt: string, identifiers: Array<{ system: string, value: string, facility: { id: string, name: string } | null }> };

export type PatientDuplicateFieldsFragment = { patientId: string, match: DuplicateMatch, visible: boolean, matchedOn: string, displayName: string, birthYear: number, facilityNames: Array<string> };

export type MyFacilitiesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyFacilitiesQuery = { myFacilities: Array<{ id: string, name: string, type: string | null }> };

export type SearchPatientsQueryVariables = Exact<{
  input: SearchPatientsInput;
}>;


export type SearchPatientsQuery = { searchPatients: Array<{ id: string, givenName: string, familyName: string, birthDate: string, sex: Sex, phone: string | null, preferredLanguage: string, consentAt: string | null, createdAt: string, identifiers: Array<{ system: string, value: string, facility: { id: string, name: string } | null }> }> };

export type PatientQueryVariables = Exact<{
  id: string | number;
}>;


export type PatientQuery = { patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex, phone: string | null, preferredLanguage: string, consentAt: string | null, createdAt: string, identifiers: Array<{ system: string, value: string, facility: { id: string, name: string } | null }> } | null };

export type CheckPatientDuplicatesQueryVariables = Exact<{
  input: PatientDraftInput;
}>;


export type CheckPatientDuplicatesQuery = { checkPatientDuplicates: Array<{ patientId: string, match: DuplicateMatch, visible: boolean, matchedOn: string, displayName: string, birthYear: number, facilityNames: Array<string> }> };

export type RegisterPatientMutationVariables = Exact<{
  input: RegisterPatientInput;
}>;


export type RegisterPatientMutation = { registerPatient: { patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex, phone: string | null, preferredLanguage: string, consentAt: string | null, createdAt: string, identifiers: Array<{ system: string, value: string, facility: { id: string, name: string } | null }> } | null, duplicates: Array<{ patientId: string, match: DuplicateMatch, visible: boolean, matchedOn: string, displayName: string, birthYear: number, facilityNames: Array<string> }> } };

export type LinkExistingPatientMutationVariables = Exact<{
  input: LinkExistingPatientInput;
}>;


export type LinkExistingPatientMutation = { linkExistingPatient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex, phone: string | null, preferredLanguage: string, consentAt: string | null, createdAt: string, identifiers: Array<{ system: string, value: string, facility: { id: string, name: string } | null }> } };

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

export type ResultItemFieldsFragment = { id: string, code: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string, receivedAt: string, reviewedAt: string | null, orderId: string | null, orderStatus: OrderStatus | null, orderPriority: OrderPriority | null, patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex }, sourceFacility: { id: string, name: string } };

export type ResultsToReviewQueryVariables = Exact<{ [key: string]: never; }>;


export type ResultsToReviewQuery = { resultsToReview: Array<{ id: string, code: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string, receivedAt: string, reviewedAt: string | null, orderId: string | null, orderStatus: OrderStatus | null, orderPriority: OrderPriority | null, patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex }, sourceFacility: { id: string, name: string } }> };

export type PatientResultsQueryVariables = Exact<{
  patientId: string | number;
}>;


export type PatientResultsQuery = { patientResults: Array<{ id: string, code: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string, receivedAt: string, reviewedAt: string | null, orderId: string | null, orderStatus: OrderStatus | null, orderPriority: OrderPriority | null, patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex }, sourceFacility: { id: string, name: string } }> };

export type ReviewResultMutationVariables = Exact<{
  input: ReviewResultInput;
}>;


export type ReviewResultMutation = { reviewResult: { id: string, code: string, display: string | null, value: string, unit: string | null, refRange: string | null, flag: ResultFlag | null, urgency: ResultUrgency, resultedAt: string, receivedAt: string, reviewedAt: string | null, orderId: string | null, orderStatus: OrderStatus | null, orderPriority: OrderPriority | null, patient: { id: string, givenName: string, familyName: string, birthDate: string, sex: Sex }, sourceFacility: { id: string, name: string } } };

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

export type ManagedUserFieldsFragment = { id: string, name: string, email: string, role: string, status: ManagedUserStatus, createdAt: string };

export type CurrentOrgRoleQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentOrgRoleQuery = { currentOrgRole: string };

export type ManagedUsersQueryVariables = Exact<{ [key: string]: never; }>;


export type ManagedUsersQuery = { managedUsers: Array<{ id: string, name: string, email: string, role: string, status: ManagedUserStatus, createdAt: string }> };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;


export type CreateUserMutation = { createUser: { url: string, expiresAt: string, user: { id: string, name: string, email: string, role: string, status: ManagedUserStatus, createdAt: string } } };

export type CreatePasswordLinkMutationVariables = Exact<{
  userId: string | number;
}>;


export type CreatePasswordLinkMutation = { createPasswordLink: { url: string, expiresAt: string, user: { id: string, name: string, email: string, role: string, status: ManagedUserStatus, createdAt: string } } };

export type UpdateUserRoleMutationVariables = Exact<{
  input: UpdateUserRoleInput;
}>;


export type UpdateUserRoleMutation = { updateUserRole: { id: string, name: string, email: string, role: string, status: ManagedUserStatus, createdAt: string } };

export type SetUserActiveMutationVariables = Exact<{
  userId: string | number;
  active: boolean;
}>;


export type SetUserActiveMutation = { setUserActive: { id: string, name: string, email: string, role: string, status: ManagedUserStatus, createdAt: string } };

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

export type WiseResultEvaluationQueryVariables = Exact<{
  resultId: string | number;
}>;


export type WiseResultEvaluationQuery = { resultEvaluation: { id: string, pathwayName: string, classification: ResultClassification, urgency: Urgency, reason: string, guideline: string, slaHours: number | null } | null };

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

export type WiseFinalizeEncounterBillMutationVariables = Exact<{
  id: string | number;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseFinalizeEncounterBillMutation = { finalizeEncounterBill: { id: string } };

export type WiseAcceptOrderMutationVariables = Exact<{
  orderId: string | number;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseAcceptOrderMutation = { acceptOrder: { id: string, status: OrderStatus } };

export type WiseMarkOrderCollectedMutationVariables = Exact<{
  orderId: string | number;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseMarkOrderCollectedMutation = { markOrderCollected: { id: string, status: OrderStatus } };

export type WiseSaveReportToChartMutationVariables = Exact<{
  chatId: string | number;
  toolCallId: string;
  wiseOrigin?: WiseOriginInput | null | undefined;
}>;


export type WiseSaveReportToChartMutation = { saveReportToChart: { id: string } };

export type UpdatePatientMutationVariables = Exact<{
  input: UpdatePatientInput;
}>;


export type UpdatePatientMutation = { updatePatient: { id: string, phone: string | null, preferredLanguage: string, barangay: string | null } };

export type WisePatientContactQueryVariables = Exact<{
  id: string | number;
}>;


export type WisePatientContactQuery = { patient: { id: string, givenName: string, familyName: string, phone: string | null, preferredLanguage: string, barangay: string | null } | null };

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
  facilityId?: string | number | null | undefined;
}>;


export type WiseToolSettingsQuery = { wiseToolSettings: { facilityId: string | null, facilities: Array<{ id: string, name: string, type: string, isAdmin: boolean }>, tools: Array<{ name: string, label: string, summary: string, kind: string, category: string, locked: boolean, comingSoon: boolean, facilityDefault: boolean, facilityEnabled: boolean, myEnabled: boolean, enabled: boolean }> } };

export type SetWiseToolEnabledMutationVariables = Exact<{
  facilityId: string | number;
  toolName: string;
  enabled: boolean;
}>;


export type SetWiseToolEnabledMutation = { setWiseToolEnabled: boolean };

export type SetMyWiseToolEnabledMutationVariables = Exact<{
  toolName: string;
  enabled: boolean;
}>;


export type SetMyWiseToolEnabledMutation = { setMyWiseToolEnabled: boolean };

export const ChatFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Chat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"automationRun"}},{"kind":"Field","name":{"kind":"Name","value":"messages"}}]}}]} as unknown as DocumentNode<ChatFieldsFragment, unknown>;
export const SharedChatFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}}]} as unknown as DocumentNode<SharedChatFieldsFragment, unknown>;
export const ClinicSummaryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"orgId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<ClinicSummaryFieldsFragment, unknown>;
export const SignatoryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignatoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DocumentSignatory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"licenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}},{"kind":"Field","name":{"kind":"Name","value":"facilityName"}},{"kind":"Field","name":{"kind":"Name","value":"facilityAddress"}},{"kind":"Field","name":{"kind":"Name","value":"facilityPhone"}}]}}]} as unknown as DocumentNode<SignatoryFieldsFragment, unknown>;
export const EncounterFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EncounterFieldsFragment, unknown>;
export const VitalSignsFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"VitalSignsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VitalSigns"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"systolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"diastolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"heartRateBpm"}},{"kind":"Field","name":{"kind":"Name","value":"respiratoryRate"}},{"kind":"Field","name":{"kind":"Name","value":"temperatureC"}},{"kind":"Field","name":{"kind":"Name","value":"spo2Pct"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"heightCm"}},{"kind":"Field","name":{"kind":"Name","value":"bmi"}},{"kind":"Field","name":{"kind":"Name","value":"bloodGlucoseMgDl"}},{"kind":"Field","name":{"kind":"Name","value":"painScore"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}}]} as unknown as DocumentNode<VitalSignsFieldsFragment, unknown>;
export const DiagnosisFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"certainty"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}}]} as unknown as DocumentNode<DiagnosisFieldsFragment, unknown>;
export const AllergyFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"substance"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}}]}}]} as unknown as DocumentNode<AllergyFieldsFragment, unknown>;
export const OrderFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicalOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"targetFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}}]}}]}}]} as unknown as DocumentNode<OrderFieldsFragment, unknown>;
export const PrescriptionItemFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}}]} as unknown as DocumentNode<PrescriptionItemFieldsFragment, unknown>;
export const PrescriptionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rxNumber"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}}]} as unknown as DocumentNode<PrescriptionFieldsFragment, unknown>;
export const MedicalCertificateFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"certificateNumber"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"fitness"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<MedicalCertificateFieldsFragment, unknown>;
export const EncounterBillFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterBillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterBill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"charges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"subtotal"}},{"kind":"Field","name":{"kind":"Name","value":"discountKind"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPackageCode"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthCoverage"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"orNumber"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<EncounterBillFieldsFragment, unknown>;
export const EncounterRecordFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}},{"kind":"Field","name":{"kind":"Name","value":"history"}},{"kind":"Field","name":{"kind":"Name","value":"physicalExam"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"patientInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"followUpOn"}}]}},{"kind":"Field","name":{"kind":"Name","value":"vitals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"VitalSignsFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allergies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AllergyFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"orders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"medicalCertificates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bills"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterBillFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"VitalSignsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VitalSigns"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"systolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"diastolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"heartRateBpm"}},{"kind":"Field","name":{"kind":"Name","value":"respiratoryRate"}},{"kind":"Field","name":{"kind":"Name","value":"temperatureC"}},{"kind":"Field","name":{"kind":"Name","value":"spo2Pct"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"heightCm"}},{"kind":"Field","name":{"kind":"Name","value":"bmi"}},{"kind":"Field","name":{"kind":"Name","value":"bloodGlucoseMgDl"}},{"kind":"Field","name":{"kind":"Name","value":"painScore"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"certainty"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"substance"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicalOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"targetFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rxNumber"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"certificateNumber"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"fitness"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterBillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterBill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"charges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"subtotal"}},{"kind":"Field","name":{"kind":"Name","value":"discountKind"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPackageCode"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthCoverage"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"orNumber"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<EncounterRecordFieldsFragment, unknown>;
export const PatientOverviewFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientOverviewFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientOverview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"visits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"orders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"billStatus"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"certainty"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rxNumber"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicalOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"targetFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}}]}}]}}]} as unknown as DocumentNode<PatientOverviewFieldsFragment, unknown>;
export const MemoryFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MemoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Memory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"supersededBy"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<MemoryFieldsFragment, unknown>;
export const LabOrderFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LabOrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderingDoctorName"}},{"kind":"Field","name":{"kind":"Name","value":"orderingFacilityName"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<LabOrderFieldsFragment, unknown>;
export const PathwayFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PathwayFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Pathway"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"resultReviewHours"}},{"kind":"Field","name":{"kind":"Name","value":"criticalAlertHours"}},{"kind":"Field","name":{"kind":"Name","value":"criticalFlagNextState"}},{"kind":"Field","name":{"kind":"Name","value":"closureEvidence"}},{"kind":"Field","name":{"kind":"Name","value":"closureDescription"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}}]}},{"kind":"Field","name":{"kind":"Name","value":"triggers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"codeSystem"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"conversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"factor"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}},{"kind":"Field","name":{"kind":"Name","value":"note"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"classification"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"guideline"}},{"kind":"Field","name":{"kind":"Name","value":"nextState"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}}]}}]}}]}}]} as unknown as DocumentNode<PathwayFieldsFragment, unknown>;
export const ResultEvaluationFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ResultEvaluationFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ResultEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"resultId"}},{"kind":"Field","name":{"kind":"Name","value":"pathwayKey"}},{"kind":"Field","name":{"kind":"Name","value":"pathwayName"}},{"kind":"Field","name":{"kind":"Name","value":"ruleVersion"}},{"kind":"Field","name":{"kind":"Name","value":"classification"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"guideline"}},{"kind":"Field","name":{"kind":"Name","value":"nextState"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}},{"kind":"Field","name":{"kind":"Name","value":"basis"}},{"kind":"Field","name":{"kind":"Name","value":"evaluatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"band"}},{"kind":"Field","name":{"kind":"Name","value":"comparedValue"}},{"kind":"Field","name":{"kind":"Name","value":"comparedUnit"}},{"kind":"Field","name":{"kind":"Name","value":"received"}}]}}]}}]} as unknown as DocumentNode<ResultEvaluationFieldsFragment, unknown>;
export const PatientFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"system"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<PatientFieldsFragment, unknown>;
export const PatientDuplicateFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientDuplicateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDuplicate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"match"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"matchedOn"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"birthYear"}},{"kind":"Field","name":{"kind":"Name","value":"facilityNames"}}]}}]} as unknown as DocumentNode<PatientDuplicateFieldsFragment, unknown>;
export const ResultItemFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ResultItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ResultItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderStatus"}},{"kind":"Field","name":{"kind":"Name","value":"orderPriority"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sourceFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ResultItemFieldsFragment, unknown>;
export const SkillFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SkillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Skill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"}}]}}]} as unknown as DocumentNode<SkillFieldsFragment, unknown>;
export const UsageRecordFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsageRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsageRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"messageCount"}},{"kind":"Field","name":{"kind":"Name","value":"webMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"slackMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"teamsMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"telegramMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mattermostMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"discordMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"whatsappMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"adminMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"mcpMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"contextRecommendationsMessageCount"}},{"kind":"Field","name":{"kind":"Name","value":"inputNoCacheTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheReadTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheWriteTokens"}},{"kind":"Field","name":{"kind":"Name","value":"outputTotalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"totalTokens"}},{"kind":"Field","name":{"kind":"Name","value":"inputNoCacheCost"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheReadCost"}},{"kind":"Field","name":{"kind":"Name","value":"inputCacheWriteCost"}},{"kind":"Field","name":{"kind":"Name","value":"outputCost"}},{"kind":"Field","name":{"kind":"Name","value":"totalCost"}}]}}]} as unknown as DocumentNode<UsageRecordFieldsFragment, unknown>;
export const UsagePeriodSelectionFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UsagePeriodSelectionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"UsagePeriodSelection"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"savedPeriodId"}}]}}]} as unknown as DocumentNode<UsagePeriodSelectionFieldsFragment, unknown>;
export const SavedUsagePeriodFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SavedUsagePeriodFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SavedUsagePeriod"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"days"}},{"kind":"Field","name":{"kind":"Name","value":"granularity"}}]}}]} as unknown as DocumentNode<SavedUsagePeriodFieldsFragment, unknown>;
export const ManagedUserFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<ManagedUserFieldsFragment, unknown>;
export const WiseProposalOutcomeFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WiseProposalOutcomeFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WiseProposalOutcome"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"toolName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}}]}}]} as unknown as DocumentNode<WiseProposalOutcomeFieldsFragment, unknown>;
export const ChartDownloadDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChartDownload"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chartDownload"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}]}]}}]} as unknown as DocumentNode<ChartDownloadQuery, ChartDownloadQueryVariables>;
export const UpdateChartConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateChartConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"config"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateChartConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}},{"kind":"Argument","name":{"kind":"Name","value":"config"},"value":{"kind":"Variable","name":{"kind":"Name","value":"config"}}}]}]}}]} as unknown as DocumentNode<UpdateChartConfigMutation, UpdateChartConfigMutationVariables>;
export const UpdateMapConfigDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMapConfig"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mapId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"config"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMapConfig"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"mapId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mapId"}}},{"kind":"Argument","name":{"kind":"Name","value":"config"},"value":{"kind":"Variable","name":{"kind":"Name","value":"config"}}}]}]}}]} as unknown as DocumentNode<UpdateMapConfigMutation, UpdateMapConfigMutationVariables>;
export const ChartPluginsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChartPlugins"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chartPlugins"}}]}}]} as unknown as DocumentNode<ChartPluginsQuery, ChartPluginsQueryVariables>;
export const ChartPluginSourceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChartPluginSource"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"version"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chartPluginSource"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"version"},"value":{"kind":"Variable","name":{"kind":"Name","value":"version"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<ChartPluginSourceQuery, ChartPluginSourceQueryVariables>;
export const ChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Chat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ChatFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Chat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"automationRun"}},{"kind":"Field","name":{"kind":"Name","value":"messages"}}]}}]} as unknown as DocumentNode<ChatQuery, ChatQueryVariables>;
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
export const SharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"share"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SharedChatFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"chat"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ChatFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Chat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isStarred"}},{"kind":"Field","name":{"kind":"Name","value":"isOnboarding"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"automationRun"}},{"kind":"Field","name":{"kind":"Name","value":"messages"}}]}}]} as unknown as DocumentNode<SharedChatQuery, SharedChatQueryVariables>;
export const ChatShareOptionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatShareOptions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatShareOptions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shareId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"allowedUserIds"}}]}}]}}]} as unknown as DocumentNode<ChatShareOptionsQuery, ChatShareOptionsQueryVariables>;
export const CreateSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateSharedChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SharedChatFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SharedChatFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"SharedChat"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"clinicId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"visibility"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"authorName"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"forkMetadata"}},{"kind":"Field","name":{"kind":"Name","value":"messageBubbles"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"charCount"}}]}}]}}]} as unknown as DocumentNode<CreateSharedChatMutation, CreateSharedChatMutationVariables>;
export const UpdateSharedChatAccessDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSharedChatAccess"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"allowedUserIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSharedChatAccess"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}},{"kind":"Argument","name":{"kind":"Name","value":"allowedUserIds"},"value":{"kind":"Variable","name":{"kind":"Name","value":"allowedUserIds"}}}]}]}}]} as unknown as DocumentNode<UpdateSharedChatAccessMutation, UpdateSharedChatAccessMutationVariables>;
export const DeleteSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}}]}]}}]} as unknown as DocumentNode<DeleteSharedChatMutation, DeleteSharedChatMutationVariables>;
export const ForkSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ForkSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ForkSharedChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"forkSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}}]}}]}}]} as unknown as DocumentNode<ForkSharedChatMutation, ForkSharedChatMutationVariables>;
export const AskSharedChatDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AskSharedChat"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ForkSharedChatInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"askSharedChat"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}}]}}]}}]} as unknown as DocumentNode<AskSharedChatMutation, AskSharedChatMutationVariables>;
export const SharedChatQuickQuestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SharedChatQuickQuestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sharedChatQuickQuestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shareId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shareId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<SharedChatQuickQuestionsQuery, SharedChatQuickQuestionsQueryVariables>;
export const ChatShareMembersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ChatShareMembers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"chatShareMembers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}}]} as unknown as DocumentNode<ChatShareMembersQuery, ChatShareMembersQueryVariables>;
export const CurrentClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CurrentClinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"currentClinic"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"orgId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<CurrentClinicQuery, CurrentClinicQueryVariables>;
export const ClinicsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Clinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"orgId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<ClinicsQuery, ClinicsQueryVariables>;
export const CreateClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateClinic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateClinicInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createClinic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"orgId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<CreateClinicMutation, CreateClinicMutationVariables>;
export const RenameClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RenameClinic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RenameClinicInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"renameClinic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ClinicSummaryFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ClinicSummaryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicSummary"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"orgId"}},{"kind":"Field","name":{"kind":"Name","value":"userRole"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<RenameClinicMutation, RenameClinicMutationVariables>;
export const DeleteClinicDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteClinic"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteClinic"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}]}]}}]} as unknown as DocumentNode<DeleteClinicMutation, DeleteClinicMutationVariables>;
export const SavedPromptsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedPrompts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedPrompts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<SavedPromptsQuery, SavedPromptsQueryVariables>;
export const CreateSavedPromptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSavedPrompt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SavedPromptInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSavedPrompt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<CreateSavedPromptMutation, CreateSavedPromptMutationVariables>;
export const UpdateSavedPromptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSavedPrompt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateSavedPromptInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateSavedPrompt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<UpdateSavedPromptMutation, UpdateSavedPromptMutationVariables>;
export const DeleteSavedPromptDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteSavedPrompt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"promptId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteSavedPrompt"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"promptId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"promptId"}}}]}]}}]} as unknown as DocumentNode<DeleteSavedPromptMutation, DeleteSavedPromptMutationVariables>;
export const ClinicSavedPromptsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ClinicSavedPrompts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clinicSavedPrompts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"clinicId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"clinicId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"prompt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<ClinicSavedPromptsQuery, ClinicSavedPromptsQueryVariables>;
export const DatabaseObjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DatabaseObjects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"databaseObjects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"database"}},{"kind":"Field","name":{"kind":"Name","value":"schema"}},{"kind":"Field","name":{"kind":"Name","value":"table"}},{"kind":"Field","name":{"kind":"Name","value":"fqdn"}}]}}]}}]} as unknown as DocumentNode<DatabaseObjectsQuery, DatabaseObjectsQueryVariables>;
export const DisplaySettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DisplaySettings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displaySettings"}}]}}]} as unknown as DocumentNode<DisplaySettingsQuery, DisplaySettingsQueryVariables>;
export const UpdateDisplaySettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDisplaySettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"JSON"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDisplaySettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateDisplaySettingsMutation, UpdateDisplaySettingsMutationVariables>;
export const EncounterRecordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EncounterRecord"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounterRecord"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"encounterId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"encounterId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterRecordFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"VitalSignsFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"VitalSigns"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"systolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"diastolicMmHg"}},{"kind":"Field","name":{"kind":"Name","value":"heartRateBpm"}},{"kind":"Field","name":{"kind":"Name","value":"respiratoryRate"}},{"kind":"Field","name":{"kind":"Name","value":"temperatureC"}},{"kind":"Field","name":{"kind":"Name","value":"spo2Pct"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"heightCm"}},{"kind":"Field","name":{"kind":"Name","value":"bmi"}},{"kind":"Field","name":{"kind":"Name","value":"bloodGlucoseMgDl"}},{"kind":"Field","name":{"kind":"Name","value":"painScore"}},{"kind":"Field","name":{"kind":"Name","value":"recordedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"certainty"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"substance"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicalOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"targetFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rxNumber"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"certificateNumber"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"fitness"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterBillFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterBill"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"charges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unitPrice"}},{"kind":"Field","name":{"kind":"Name","value":"amount"}}]}},{"kind":"Field","name":{"kind":"Name","value":"subtotal"}},{"kind":"Field","name":{"kind":"Name","value":"discountKind"}},{"kind":"Field","name":{"kind":"Name","value":"discountAmount"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthPackageCode"}},{"kind":"Field","name":{"kind":"Name","value":"philhealthCoverage"}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"finalizedAt"}},{"kind":"Field","name":{"kind":"Name","value":"paidAt"}},{"kind":"Field","name":{"kind":"Name","value":"orNumber"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterRecordFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterRecord"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}},{"kind":"Field","name":{"kind":"Name","value":"history"}},{"kind":"Field","name":{"kind":"Name","value":"physicalExam"}},{"kind":"Field","name":{"kind":"Name","value":"assessment"}},{"kind":"Field","name":{"kind":"Name","value":"plan"}},{"kind":"Field","name":{"kind":"Name","value":"patientInstructions"}},{"kind":"Field","name":{"kind":"Name","value":"followUpOn"}}]}},{"kind":"Field","name":{"kind":"Name","value":"vitals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"VitalSignsFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"allergies"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AllergyFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"orders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"medicalCertificates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bills"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterBillFields"}}]}}]}}]} as unknown as DocumentNode<EncounterRecordQuery, EncounterRecordQueryVariables>;
export const PatientOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientOverview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientOverviewFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiagnosisFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"EncounterDiagnosis"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"icd10Code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"certainty"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rxNumber"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"OrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ClinicalOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"closedAt"}},{"kind":"Field","name":{"kind":"Name","value":"statusReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"targetFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"results"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientOverviewFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientOverview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"visits"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"diagnoses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiagnosisFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"prescriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"orders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"OrderFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"billStatus"}}]}}]}}]} as unknown as DocumentNode<PatientOverviewQuery, PatientOverviewQueryVariables>;
export const PatientAllergiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientAllergies"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientAllergies"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"AllergyFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"AllergyFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientAllergy"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"substance"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"reaction"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}}]}}]} as unknown as DocumentNode<PatientAllergiesQuery, PatientAllergiesQueryVariables>;
export const SearchIcd10Document = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchIcd10"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchIcd10"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<SearchIcd10Query, SearchIcd10QueryVariables>;
export const OrderOptionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"OrderOptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"orderableTests"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}}]}},{"kind":"Field","name":{"kind":"Name","value":"orderTargets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<OrderOptionsQuery, OrderOptionsQueryVariables>;
export const PrescriptionPrintDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PrescriptionPrint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"prescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionFields"}},{"kind":"Field","name":{"kind":"Name","value":"signatory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignatoryFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PrescriptionItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"genericName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"strength"}},{"kind":"Field","name":{"kind":"Name","value":"form"}},{"kind":"Field","name":{"kind":"Name","value":"dose"}},{"kind":"Field","name":{"kind":"Name","value":"route"}},{"kind":"Field","name":{"kind":"Name","value":"frequency"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"refills"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PrescriptionFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Prescription"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rxNumber"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PrescriptionItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignatoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DocumentSignatory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"licenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}},{"kind":"Field","name":{"kind":"Name","value":"facilityName"}},{"kind":"Field","name":{"kind":"Name","value":"facilityAddress"}},{"kind":"Field","name":{"kind":"Name","value":"facilityPhone"}}]}}]} as unknown as DocumentNode<PrescriptionPrintQuery, PrescriptionPrintQueryVariables>;
export const MedicalCertificatePrintDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MedicalCertificatePrint"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"medicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MedicalCertificateFields"}},{"kind":"Field","name":{"kind":"Name","value":"signatory"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"SignatoryFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MedicalCertificateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MedicalCertificate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"encounterId"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"certificateNumber"}},{"kind":"Field","name":{"kind":"Name","value":"examinedOn"}},{"kind":"Field","name":{"kind":"Name","value":"diagnosisText"}},{"kind":"Field","name":{"kind":"Name","value":"fitness"}},{"kind":"Field","name":{"kind":"Name","value":"restFrom"}},{"kind":"Field","name":{"kind":"Name","value":"restDays"}},{"kind":"Field","name":{"kind":"Name","value":"remarks"}},{"kind":"Field","name":{"kind":"Name","value":"purpose"}},{"kind":"Field","name":{"kind":"Name","value":"issuedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidedAt"}},{"kind":"Field","name":{"kind":"Name","value":"voidReason"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"SignatoryFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"DocumentSignatory"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"licenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}},{"kind":"Field","name":{"kind":"Name","value":"facilityName"}},{"kind":"Field","name":{"kind":"Name","value":"facilityAddress"}},{"kind":"Field","name":{"kind":"Name","value":"facilityPhone"}}]}}]} as unknown as DocumentNode<MedicalCertificatePrintQuery, MedicalCertificatePrintQueryVariables>;
export const MyClinicianProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyClinicianProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myClinicianProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}}]}}]}}]} as unknown as DocumentNode<MyClinicianProfileQuery, MyClinicianProfileQueryVariables>;
export const UpdateMyClinicianProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMyClinicianProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateClinicianProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMyClinicianProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"credentials"}},{"kind":"Field","name":{"kind":"Name","value":"specialty"}},{"kind":"Field","name":{"kind":"Name","value":"prcLicenseNumber"}},{"kind":"Field","name":{"kind":"Name","value":"ptrNumber"}}]}}]}}]} as unknown as DocumentNode<UpdateMyClinicianProfileMutation, UpdateMyClinicianProfileMutationVariables>;
export const UpdateEncounterNoteDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateEncounterNote"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateEncounterNoteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateEncounterNote"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}}]} as unknown as DocumentNode<UpdateEncounterNoteMutation, UpdateEncounterNoteMutationVariables>;
export const RecordVitalsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RecordVitals"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecordVitalsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recordVitals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<RecordVitalsMutation, RecordVitalsMutationVariables>;
export const VoidVitalsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidVitals"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidVitals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidVitalsMutation, VoidVitalsMutationVariables>;
export const AddDiagnosisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddDiagnosis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddDiagnosisInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addDiagnosis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AddDiagnosisMutation, AddDiagnosisMutationVariables>;
export const UpdateDiagnosisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDiagnosis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateDiagnosisInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateDiagnosis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateDiagnosisMutation, UpdateDiagnosisMutationVariables>;
export const VoidDiagnosisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidDiagnosis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidDiagnosis"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidDiagnosisMutation, VoidDiagnosisMutationVariables>;
export const AddAllergyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddAllergy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AddAllergyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addAllergy"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AddAllergyMutation, AddAllergyMutationVariables>;
export const VoidAllergyDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidAllergy"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidAllergyInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidAllergy"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidAllergyMutation, VoidAllergyMutationVariables>;
export const CreateEncounterOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateEncounterOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateEncounterOrderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createEncounterOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateEncounterOrderMutation, CreateEncounterOrderMutationVariables>;
export const SavePrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SavePrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SavePrescriptionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savePrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SavePrescriptionMutation, SavePrescriptionMutationVariables>;
export const IssuePrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IssuePrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"overrideAllergyWarning"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issuePrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"overrideAllergyWarning"},"value":{"kind":"Variable","name":{"kind":"Name","value":"overrideAllergyWarning"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<IssuePrescriptionMutation, IssuePrescriptionMutationVariables>;
export const VoidPrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidPrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidPrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidPrescriptionMutation, VoidPrescriptionMutationVariables>;
export const SaveMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveMedicalCertificateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SaveMedicalCertificateMutation, SaveMedicalCertificateMutationVariables>;
export const IssueMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"IssueMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issueMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<IssueMedicalCertificateMutation, IssueMedicalCertificateMutationVariables>;
export const VoidMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidMedicalCertificateMutation, VoidMedicalCertificateMutationVariables>;
export const SaveEncounterBillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveEncounterBill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SaveEncounterBillInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveEncounterBill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SaveEncounterBillMutation, SaveEncounterBillMutationVariables>;
export const FinalizeEncounterBillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FinalizeEncounterBill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finalizeEncounterBill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<FinalizeEncounterBillMutation, FinalizeEncounterBillMutationVariables>;
export const MarkEncounterBillPaidDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkEncounterBillPaid"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkBillPaidInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markEncounterBillPaid"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<MarkEncounterBillPaidMutation, MarkEncounterBillPaidMutationVariables>;
export const VoidEncounterBillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoidEncounterBill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"VoidEntryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voidEncounterBill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<VoidEncounterBillMutation, VoidEncounterBillMutationVariables>;
export const CreateEncounterOrdersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateEncounterOrders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateEncounterOrdersInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createEncounterOrders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}}]}}]}}]} as unknown as DocumentNode<CreateEncounterOrdersMutation, CreateEncounterOrdersMutationVariables>;
export const EncountersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Encounters"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"encounters"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EncountersQuery, EncountersQueryVariables>;
export const CreateEncounterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateEncounter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateEncounterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createEncounter"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"EncounterFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"EncounterFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Encounter"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"sourceChatId"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"doctor"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<CreateEncounterMutation, CreateEncounterMutationVariables>;
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
export const LabOrdersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LabOrders"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"status"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderStatus"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labOrders"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"status"},"value":{"kind":"Variable","name":{"kind":"Name","value":"status"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"LabOrderFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"LabOrderFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"LabOrder"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"sentAt"}},{"kind":"Field","name":{"kind":"Name","value":"acceptedAt"}},{"kind":"Field","name":{"kind":"Name","value":"collectedAt"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderingDoctorName"}},{"kind":"Field","name":{"kind":"Name","value":"orderingFacilityName"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}}]}}]} as unknown as DocumentNode<LabOrdersQuery, LabOrdersQueryVariables>;
export const LabOrderCountsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"LabOrderCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labOrderCounts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]} as unknown as DocumentNode<LabOrderCountsQuery, LabOrderCountsQueryVariables>;
export const AcceptOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AcceptOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acceptOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<AcceptOrderMutation, AcceptOrderMutationVariables>;
export const MarkOrderCollectedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkOrderCollected"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markOrderCollected"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<MarkOrderCollectedMutation, MarkOrderCollectedMutationVariables>;
export const RejectOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RejectOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderReasonInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rejectOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<RejectOrderMutation, RejectOrderMutationVariables>;
export const CancelOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"OrderReasonInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<CancelOrderMutation, CancelOrderMutationVariables>;
export const PathwaysDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Pathways"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pathways"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PathwayFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PathwayFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Pathway"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"resultReviewHours"}},{"kind":"Field","name":{"kind":"Name","value":"criticalAlertHours"}},{"kind":"Field","name":{"kind":"Name","value":"criticalFlagNextState"}},{"kind":"Field","name":{"kind":"Name","value":"closureEvidence"}},{"kind":"Field","name":{"kind":"Name","value":"closureDescription"}},{"kind":"Field","name":{"kind":"Name","value":"steps"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"state"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}}]}},{"kind":"Field","name":{"kind":"Name","value":"triggers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"codeSystem"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"conversions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"from"}},{"kind":"Field","name":{"kind":"Name","value":"factor"}},{"kind":"Field","name":{"kind":"Name","value":"offset"}},{"kind":"Field","name":{"kind":"Name","value":"note"}}]}},{"kind":"Field","name":{"kind":"Name","value":"bands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"classification"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"guideline"}},{"kind":"Field","name":{"kind":"Name","value":"nextState"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}}]}}]}}]}}]} as unknown as DocumentNode<PathwaysQuery, PathwaysQueryVariables>;
export const ResultEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ResultEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resultId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resultEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"resultId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resultId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ResultEvaluationFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ResultEvaluationFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ResultEvaluation"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"resultId"}},{"kind":"Field","name":{"kind":"Name","value":"pathwayKey"}},{"kind":"Field","name":{"kind":"Name","value":"pathwayName"}},{"kind":"Field","name":{"kind":"Name","value":"ruleVersion"}},{"kind":"Field","name":{"kind":"Name","value":"classification"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"guideline"}},{"kind":"Field","name":{"kind":"Name","value":"nextState"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}},{"kind":"Field","name":{"kind":"Name","value":"basis"}},{"kind":"Field","name":{"kind":"Name","value":"evaluatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"rule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"band"}},{"kind":"Field","name":{"kind":"Name","value":"comparedValue"}},{"kind":"Field","name":{"kind":"Name","value":"comparedUnit"}},{"kind":"Field","name":{"kind":"Name","value":"received"}}]}}]}}]} as unknown as DocumentNode<ResultEvaluationQuery, ResultEvaluationQueryVariables>;
export const MyFacilitiesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyFacilities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"myFacilities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]} as unknown as DocumentNode<MyFacilitiesQuery, MyFacilitiesQueryVariables>;
export const SearchPatientsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchPatients"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SearchPatientsInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchPatients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"system"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<SearchPatientsQuery, SearchPatientsQueryVariables>;
export const PatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Patient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"system"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<PatientQuery, PatientQueryVariables>;
export const CheckPatientDuplicatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CheckPatientDuplicates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDraftInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"checkPatientDuplicates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientDuplicateFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientDuplicateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDuplicate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"match"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"matchedOn"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"birthYear"}},{"kind":"Field","name":{"kind":"Name","value":"facilityNames"}}]}}]} as unknown as DocumentNode<CheckPatientDuplicatesQuery, CheckPatientDuplicatesQueryVariables>;
export const RegisterPatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterPatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RegisterPatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerPatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"duplicates"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientDuplicateFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"system"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientDuplicateFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"PatientDuplicate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientId"}},{"kind":"Field","name":{"kind":"Name","value":"match"}},{"kind":"Field","name":{"kind":"Name","value":"visible"}},{"kind":"Field","name":{"kind":"Name","value":"matchedOn"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"birthYear"}},{"kind":"Field","name":{"kind":"Name","value":"facilityNames"}}]}}]} as unknown as DocumentNode<RegisterPatientMutation, RegisterPatientMutationVariables>;
export const LinkExistingPatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LinkExistingPatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LinkExistingPatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"linkExistingPatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"PatientFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"PatientFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Patient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"consentAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"identifiers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"system"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"facility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<LinkExistingPatientMutation, LinkExistingPatientMutationVariables>;
export const ExportReportPdfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExportReportPdf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportReportPdf"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"data"}}]}}]}}]} as unknown as DocumentNode<ExportReportPdfMutation, ExportReportPdfMutationVariables>;
export const ExportWiseReportPdfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ExportWiseReportPdf"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportWiseReportPdf"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"filename"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"data"}}]}}]}}]} as unknown as DocumentNode<ExportWiseReportPdfMutation, ExportWiseReportPdfMutationVariables>;
export const SaveReportToChartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveReportToChart"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveReportToChart"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SaveReportToChartMutation, SaveReportToChartMutationVariables>;
export const SavedReportDocumentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedReportDocument"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedReportDocument"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]} as unknown as DocumentNode<SavedReportDocumentQuery, SavedReportDocumentQueryVariables>;
export const ResultsToReviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ResultsToReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resultsToReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ResultItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ResultItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ResultItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderStatus"}},{"kind":"Field","name":{"kind":"Name","value":"orderPriority"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sourceFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ResultsToReviewQuery, ResultsToReviewQueryVariables>;
export const PatientResultsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PatientResults"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patientResults"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"patientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"patientId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ResultItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ResultItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ResultItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderStatus"}},{"kind":"Field","name":{"kind":"Name","value":"orderPriority"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sourceFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<PatientResultsQuery, PatientResultsQueryVariables>;
export const ReviewResultDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ReviewResult"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ReviewResultInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reviewResult"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ResultItemFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ResultItemFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ResultItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"display"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"refRange"}},{"kind":"Field","name":{"kind":"Name","value":"flag"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"resultedAt"}},{"kind":"Field","name":{"kind":"Name","value":"receivedAt"}},{"kind":"Field","name":{"kind":"Name","value":"reviewedAt"}},{"kind":"Field","name":{"kind":"Name","value":"orderId"}},{"kind":"Field","name":{"kind":"Name","value":"orderStatus"}},{"kind":"Field","name":{"kind":"Name","value":"orderPriority"}},{"kind":"Field","name":{"kind":"Name","value":"patient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"sex"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sourceFacility"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<ReviewResultMutation, ReviewResultMutationVariables>;
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
export const ManagedUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ManagedUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"managedUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<ManagedUsersQuery, ManagedUsersQueryVariables>;
export const CreateUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<CreateUserMutation, CreateUserMutationVariables>;
export const CreatePasswordLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreatePasswordLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPasswordLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<CreatePasswordLinkMutation, CreatePasswordLinkMutationVariables>;
export const UpdateUserRoleDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserRole"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserRoleInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserRole"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<UpdateUserRoleMutation, UpdateUserRoleMutationVariables>;
export const SetUserActiveDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetUserActive"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"active"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setUserActive"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}},{"kind":"Argument","name":{"kind":"Name","value":"active"},"value":{"kind":"Variable","name":{"kind":"Name","value":"active"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ManagedUserFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ManagedUserFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ManagedUser"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]} as unknown as DocumentNode<SetUserActiveMutation, SetUserActiveMutationVariables>;
export const PasswordLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PasswordLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"passwordLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"isInvite"}}]}}]}}]} as unknown as DocumentNode<PasswordLinkQuery, PasswordLinkQueryVariables>;
export const SetPasswordWithLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetPasswordWithLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetPasswordWithLinkInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setPasswordWithLink"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<SetPasswordWithLinkMutation, SetPasswordWithLinkMutationVariables>;
export const HasUsersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"HasUsers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasUsers"}}]}}]} as unknown as DocumentNode<HasUsersQuery, HasUsersQueryVariables>;
export const MeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"emailVerified"}},{"kind":"Field","name":{"kind":"Name","value":"requiresPasswordReset"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const UpdateProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateProfileInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<UpdateProfileMutation, UpdateProfileMutationVariables>;
export const ModifyPasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ModifyPassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ModifyPasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"modifyPassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ModifyPasswordMutation, ModifyPasswordMutationVariables>;
export const UserPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserPreferences"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userPreferences"}}]}}]} as unknown as DocumentNode<UserPreferencesQuery, UserPreferencesQueryVariables>;
export const UpdateUserPreferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateUserPreferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateUserPreferencesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateUserPreferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<UpdateUserPreferencesMutation, UpdateUserPreferencesMutationVariables>;
export const ChangePasswordDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangePassword"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ChangePasswordInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changePassword"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}]}]}}]} as unknown as DocumentNode<ChangePasswordMutation, ChangePasswordMutationVariables>;
export const WiseResultEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WiseResultEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resultId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resultEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"resultId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resultId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pathwayName"}},{"kind":"Field","name":{"kind":"Name","value":"classification"}},{"kind":"Field","name":{"kind":"Name","value":"urgency"}},{"kind":"Field","name":{"kind":"Name","value":"reason"}},{"kind":"Field","name":{"kind":"Name","value":"guideline"}},{"kind":"Field","name":{"kind":"Name","value":"slaHours"}}]}}]}}]} as unknown as DocumentNode<WiseResultEvaluationQuery, WiseResultEvaluationQueryVariables>;
export const WiseIssuePrescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseIssuePrescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issuePrescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseIssuePrescriptionMutation, WiseIssuePrescriptionMutationVariables>;
export const WiseIssueMedicalCertificateDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseIssueMedicalCertificate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"issueMedicalCertificate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseIssueMedicalCertificateMutation, WiseIssueMedicalCertificateMutationVariables>;
export const WiseFinalizeEncounterBillDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseFinalizeEncounterBill"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finalizeEncounterBill"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseFinalizeEncounterBillMutation, WiseFinalizeEncounterBillMutationVariables>;
export const WiseAcceptOrderDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseAcceptOrder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acceptOrder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<WiseAcceptOrderMutation, WiseAcceptOrderMutationVariables>;
export const WiseMarkOrderCollectedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseMarkOrderCollected"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markOrderCollected"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"orderId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderId"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<WiseMarkOrderCollectedMutation, WiseMarkOrderCollectedMutationVariables>;
export const WiseSaveReportToChartDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"WiseSaveReportToChart"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"saveReportToChart"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolCallId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolCallId"}}},{"kind":"Argument","name":{"kind":"Name","value":"wiseOrigin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"wiseOrigin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<WiseSaveReportToChartMutation, WiseSaveReportToChartMutationVariables>;
export const UpdatePatientDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdatePatient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdatePatientInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePatient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}}]}}]}}]} as unknown as DocumentNode<UpdatePatientMutation, UpdatePatientMutationVariables>;
export const WisePatientContactDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WisePatientContact"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"patient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"givenName"}},{"kind":"Field","name":{"kind":"Name","value":"familyName"}},{"kind":"Field","name":{"kind":"Name","value":"phone"}},{"kind":"Field","name":{"kind":"Name","value":"preferredLanguage"}},{"kind":"Field","name":{"kind":"Name","value":"barangay"}}]}}]}}]} as unknown as DocumentNode<WisePatientContactQuery, WisePatientContactQueryVariables>;
export const WiseProposalOutcomesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WiseProposalOutcomes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wiseProposalOutcomes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"chatId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"chatId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WiseProposalOutcomeFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WiseProposalOutcomeFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WiseProposalOutcome"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"toolName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}}]}}]} as unknown as DocumentNode<WiseProposalOutcomesQuery, WiseProposalOutcomesQueryVariables>;
export const CancelWiseProposalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelWiseProposal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WiseOriginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelWiseProposal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WiseProposalOutcomeFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WiseProposalOutcomeFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"WiseProposalOutcome"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toolCallId"}},{"kind":"Field","name":{"kind":"Name","value":"toolName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"resourceId"}}]}}]} as unknown as DocumentNode<CancelWiseProposalMutation, CancelWiseProposalMutationVariables>;
export const WiseToolSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WiseToolSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"facilityId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"wiseToolSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"facilityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"facilityId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"facilityId"}},{"kind":"Field","name":{"kind":"Name","value":"facilities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isAdmin"}}]}},{"kind":"Field","name":{"kind":"Name","value":"tools"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"summary"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"locked"}},{"kind":"Field","name":{"kind":"Name","value":"comingSoon"}},{"kind":"Field","name":{"kind":"Name","value":"facilityDefault"}},{"kind":"Field","name":{"kind":"Name","value":"facilityEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"myEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"enabled"}}]}}]}}]}}]} as unknown as DocumentNode<WiseToolSettingsQuery, WiseToolSettingsQueryVariables>;
export const SetWiseToolEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetWiseToolEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"facilityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setWiseToolEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"facilityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"facilityId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toolName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}]}]}}]} as unknown as DocumentNode<SetWiseToolEnabledMutation, SetWiseToolEnabledMutationVariables>;
export const SetMyWiseToolEnabledDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetMyWiseToolEnabled"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setMyWiseToolEnabled"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"toolName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toolName"}}},{"kind":"Argument","name":{"kind":"Name","value":"enabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"enabled"}}}]}]}}]} as unknown as DocumentNode<SetMyWiseToolEnabledMutation, SetMyWiseToolEnabledMutationVariables>;