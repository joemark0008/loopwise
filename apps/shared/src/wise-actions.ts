import z from 'zod/v3';

import { ALLERGY_KINDS, ALLERGY_SEVERITIES, DIAGNOSIS_CERTAINTIES } from './encounter-record';
import { LAB_TESTS, type LabTest } from './lab-tests';
import { EncounterIdSchema, RULES } from './tools/encounter-proposal';
import { VitalsInputSchema } from './tools/propose-encounter';

/**
 * Wise action tools (DESIGN.md §7.3): one definition per action a clinician can take from chat. The API turns each into
 * a `propose` tool that writes nothing, the frontend renders it on the shared proposal card, and only the card's
 * Confirm calls `mutation`, as the user, with the card's `wiseOrigin`. The mutation accepts the card only from the
 * tools named here for it (`wiseActionToolsFor`), so adding an action is a definition, one line on its mutation and
 * the card's body.
 */

/** What the card names before the draft: the record it is about, which the card loads as the clinician. */
export const WISE_ACTION_SUBJECTS = ['encounter', 'patient', 'result', 'order', 'report'] as const;
export type WiseActionSubject = (typeof WISE_ACTION_SUBJECTS)[number];

/** `ProposalCard` modes: a new record, a change to one, or a void / removal (reason + second click). */
export const WISE_ACTION_MODES = ['create', 'update', 'destructive'] as const;
export type WiseActionMode = (typeof WISE_ACTION_MODES)[number];

/**
 * How hard Confirm is: one click; a reason (destructive cards); or a second click "Yes, …" (critical results, issuing,
 * finalizing). The API checks the parts that matter (the reason, the critical note) itself.
 */
export const WISE_ACTION_CONFIRMS = ['standard', 'reason', 'strong'] as const;
export type WiseActionConfirm = (typeof WISE_ACTION_CONFIRMS)[number];

/** The mutations a Wise action confirms with. */
export const WISE_ACTION_MUTATIONS = [
	'recordVitals',
	'addAllergy',
	'voidAllergy',
	'reviewResult',
	'createEncounterOrders',
	'addDiagnosis',
	'updateDiagnosis',
	'voidDiagnosis',
	'voidVitals',
	'cancelOrder',
	'acceptOrder',
	'markOrderCollected',
	'rejectOrder',
	'issuePrescription',
	'voidPrescription',
	'issueMedicalCertificate',
	'voidMedicalCertificate',
	'finalizeEncounterBill',
	'markEncounterBillPaid',
	'voidEncounterBill',
	'saveReportToChart',
	'updatePatient',
] as const;
export type WiseActionMutation = (typeof WISE_ACTION_MUTATIONS)[number];

export interface WiseActionDefinition<TInput = unknown> {
	name: `propose_${string}`;
	/** The mutations its card may confirm with (one per step for a multi-step action). */
	mutations: readonly WiseActionMutation[];
	/** Only in a patient chart chat (default). Lab staff work from their worklist, in a general chat. */
	patientChat?: boolean;
	subject: WiseActionSubject;
	mode: WiseActionMode;
	confirm: WiseActionConfirm;
	/** For the model. Ends with the rules that keep the clinician in charge. */
	description: string;
	/** Loose on purpose: the card validates with the form's schema and the clinician fixes what the model got wrong. */
	InputSchema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
}

export const ActionOutputSchema = z.object({
	_version: z.literal('1').optional(),
	success: z.literal(true),
	/** The chart chat's patient; absent outside one (lab steps). */
	patientId: z.string().optional(),
	/** The encounter or result the card is about; absent for a patient-level action (allergies). */
	subjectId: z.string().optional(),
	/** `propose_order`: the tests Wise resolved from the clinician's words. */
	tests: z.array(z.object({ code: z.string(), display: z.string(), kind: z.enum(['lab', 'imaging']) })).optional(),
});
export type ActionOutput = z.infer<typeof ActionOutputSchema>;

const ResultIdSchema = z.string().describe('The result id from list_results_to_review.');

export const proposeVitals = {
	name: 'propose_vitals',
	mutations: ['recordVitals'],
	subject: 'encounter',
	mode: 'create',
	confirm: 'standard',
	description: [
		'Show the clinician the vital signs they stated, for a visit that already exists, in a card they can edit,',
		"confirm or cancel. Use the encounter id from the patient record (today's visit unless they name another); for a",
		'new visit use propose_encounter instead. Only the measurements they stated; never send 0.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		vitals: VitalsInputSchema.unwrap().describe(
			'The vital signs the clinician stated. Leave out any not stated; never send 0.',
		),
	}),
} as const satisfies WiseActionDefinition;

export const proposeAllergy = {
	name: 'propose_allergy',
	mutations: ['addAllergy'],
	subject: 'patient',
	mode: 'create',
	confirm: 'standard',
	description: [
		"Show the clinician an allergy to add to this patient's record, in a card they can edit, confirm or cancel. Only",
		'what they stated: the substance, and the reaction and severity if they said.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		substance: z.string().max(120).describe('e.g. "Penicillin", "Shrimp".'),
		kind: z.enum(ALLERGY_KINDS).optional().describe('Default drug.'),
		reaction: z.string().max(300).optional().describe('e.g. "Rash", "Anaphylaxis".'),
		severity: z.enum(ALLERGY_SEVERITIES).optional(),
	}),
} as const satisfies WiseActionDefinition;

export const proposeRemoveAllergy = {
	name: 'propose_remove_allergy',
	mutations: ['voidAllergy'],
	subject: 'patient',
	mode: 'destructive',
	confirm: 'reason',
	description: [
		"Show the clinician the removal of one of this patient's recorded allergies (entered in error, or ruled out), in",
		'a card where they give the reason and confirm twice. Name the substance as it is recorded. It stays in the record,',
		'struck through.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		substance: z.string().max(120).describe('The recorded allergy to remove, e.g. "Penicillin".'),
		reason: z.string().max(300).optional().describe('Why, if the clinician said; they confirm it in the card.'),
	}),
} as const satisfies WiseActionDefinition;

export const proposeResultReview = {
	name: 'propose_result_review',
	mutations: ['reviewResult'],
	subject: 'result',
	mode: 'update',
	confirm: 'standard',
	description: [
		'Show the clinician a card to mark one result reviewed, with their note. Use the result id from',
		'list_results_to_review. A critical result needs a note of what they did (called the patient, referred, …) and a',
		'second click; ask them for it if they have not said. Never draft a patient message for a critical value.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		resultId: ResultIdSchema,
		note: z.string().max(1000).optional().describe('What the clinician concluded or did, in their words.'),
	}),
} as const satisfies WiseActionDefinition;

export const MAX_ORDER_TESTS = 10;

export const proposeOrder = {
	name: 'propose_order',
	mutations: ['createEncounterOrders'],
	subject: 'encounter',
	mode: 'create',
	confirm: 'standard',
	description: [
		'Show the clinician lab or imaging orders for a visit that exists, in a card where they pick the lab and confirm.',
		"Use the encounter id from the patient record (today's visit unless they name another). Name each test as the",
		`clinician said it (e.g. "HbA1c", "FBS", "lipid panel", "chest x-ray"); the tests that can be ordered are:`,
		`${LAB_TESTS.map((test) => test.display).join(', ')}. Put the lab they named in targetFacility.`,
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		tests: z.array(z.string()).min(1).max(MAX_ORDER_TESTS).describe('Test names or LOINC codes.'),
		targetFacility: z.string().max(200).optional().describe('The lab or imaging center, e.g. "Bohol Diagnostics".'),
		priority: z.enum(['routine', 'urgent', 'stat']).optional().describe('Default routine.'),
		notes: z.string().max(500).optional().describe('Notes for the lab, only if the clinician gave them.'),
	}),
} as const satisfies WiseActionDefinition;

const reasonField = z.string().max(300).optional().describe('Why, if the clinician said; they confirm it in the card.');

export const proposeDiagnosis = {
	name: 'propose_diagnosis',
	mutations: ['addDiagnosis', 'updateDiagnosis'],
	subject: 'encounter',
	mode: 'create',
	confirm: 'standard',
	description: [
		'Show the clinician a diagnosis for a visit that exists, with its ICD-10 code, in a card they can edit, confirm or',
		'cancel. If the visit already has that code, the card changes its certainty, primary flag or notes instead. Only',
		'diagnoses the clinician stated or agreed to.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		icd10Code: z.string().max(10).describe('ICD-10 (WHO 2010), e.g. "E11.9".'),
		display: z.string().max(300).describe('The diagnosis, normally the ICD-10 title.'),
		certainty: z.enum(DIAGNOSIS_CERTAINTIES).optional().describe('Default provisional.'),
		isPrimary: z.boolean().optional(),
		notes: z.string().max(1000).optional(),
	}),
} as const satisfies WiseActionDefinition;

export const proposeVoidDiagnosis = {
	name: 'propose_void_diagnosis',
	mutations: ['voidDiagnosis'],
	subject: 'encounter',
	mode: 'destructive',
	confirm: 'reason',
	description: [
		'Show the clinician the removal of a diagnosis entered in error on a visit, by its ICD-10 code; it stays in the',
		'record, struck through. They give the reason and confirm twice.',
		RULES,
	].join(' '),
	InputSchema: z.object({ encounterId: EncounterIdSchema, icd10Code: z.string().max(10), reason: reasonField }),
} as const satisfies WiseActionDefinition;

export const proposeVoidVitals = {
	name: 'propose_void_vitals',
	mutations: ['voidVitals'],
	subject: 'encounter',
	mode: 'destructive',
	confirm: 'reason',
	description: [
		'Show the clinician the removal of a set of vital signs entered in error on a visit (the latest set unless they',
		'pick another in the card); it stays in the record, struck through. To correct vitals, remove the wrong set and',
		'record the right one with propose_vitals.',
		RULES,
	].join(' '),
	InputSchema: z.object({ encounterId: EncounterIdSchema, reason: reasonField }),
} as const satisfies WiseActionDefinition;

export const proposeCancelOrder = {
	name: 'propose_cancel_order',
	mutations: ['cancelOrder'],
	subject: 'encounter',
	mode: 'destructive',
	confirm: 'reason',
	description: [
		'Show the clinician the cancellation of a lab or imaging order of a visit, before the specimen is collected; the',
		'lab sees the reason. Name the test as ordered.',
		RULES,
	].join(' '),
	InputSchema: z.object({ encounterId: EncounterIdSchema, test: z.string().max(200), reason: reasonField }),
} as const satisfies WiseActionDefinition;

export const LAB_ORDER_STEPS = ['accept', 'collect', 'reject'] as const;

export const proposeLabOrderStep = {
	name: 'propose_lab_order_step',
	mutations: ['acceptOrder', 'markOrderCollected', 'rejectOrder'],
	subject: 'order',
	mode: 'update',
	confirm: 'standard',
	patientChat: false,
	description: [
		"For lab and imaging staff: show a card that moves one order on the facility's worklist (accept it, mark the",
		'specimen collected, or reject it with the reason the doctor sees). Use the order id from list_lab_orders. One',
		'order per card.',
		RULES.replace(' Only available in a patient chart chat.', ''),
	].join(' '),
	InputSchema: z.object({
		orderId: z.string().describe('The order id from list_lab_orders.'),
		step: z.enum(LAB_ORDER_STEPS),
		reason: z.string().max(500).optional().describe('For reject: why, as the clinician said.'),
	}),
} as const satisfies WiseActionDefinition;

export const DOCUMENT_KINDS = ['prescription', 'medical_certificate'] as const;

export const proposeIssueDocument = {
	name: 'propose_issue_document',
	mutations: ['issuePrescription', 'issueMedicalCertificate'],
	subject: 'encounter',
	mode: 'update',
	confirm: 'strong',
	description: [
		'Show the clinician a card to issue (sign) the draft prescription or medical certificate of a visit, under their',
		'name and PRC license; it is locked from then on. They confirm twice. Draft or change it first with',
		'propose_prescription or propose_medical_certificate.',
		RULES,
	].join(' '),
	InputSchema: z.object({ encounterId: EncounterIdSchema, document: z.enum(DOCUMENT_KINDS) }),
} as const satisfies WiseActionDefinition;

export const proposeVoidDocument = {
	name: 'propose_void_document',
	mutations: ['voidPrescription', 'voidMedicalCertificate'],
	subject: 'encounter',
	mode: 'destructive',
	confirm: 'reason',
	description: [
		'Show the clinician a card to void the prescription or medical certificate of a visit (issued or draft); it stays',
		'in the record, marked void. They give the reason and confirm twice.',
		RULES,
	].join(' '),
	InputSchema: z.object({ encounterId: EncounterIdSchema, document: z.enum(DOCUMENT_KINDS), reason: reasonField }),
} as const satisfies WiseActionDefinition;

export const BILL_STEPS = ['finalize', 'pay', 'void'] as const;

export const proposeBillStep = {
	name: 'propose_bill_step',
	mutations: ['finalizeEncounterBill', 'markEncounterBillPaid', 'voidEncounterBill'],
	subject: 'encounter',
	mode: 'update',
	confirm: 'standard',
	description: [
		"Show the clinician a card for the next step of a visit's bill: finalize the draft (locked after; they confirm",
		'twice), mark it paid with the official receipt (OR) number, or void it with a reason. Draft or change the',
		'charges first with propose_charges.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		step: z.enum(BILL_STEPS),
		orNumber: z
			.string()
			.max(40)
			.optional()
			.describe('For pay: the official receipt number, as the clinician said.'),
		reason: reasonField,
	}),
} as const satisfies WiseActionDefinition;

export const proposeSaveReport = {
	name: 'propose_save_report',
	mutations: ['saveReportToChart'],
	subject: 'report',
	mode: 'create',
	confirm: 'standard',
	description: [
		"Show the clinician a card to save one version of a report about this patient to the chart's documents, frozen",
		'as it is. Use the report id the report tool returned (the latest version unless they name one).',
		RULES,
	].join(' '),
	InputSchema: z.object({
		reportId: z.string().describe('The report id from the report tool.'),
		version: z.number().int().optional().describe('The version to save; default the latest.'),
	}),
} as const satisfies WiseActionDefinition;

export const proposePatientUpdate = {
	name: 'propose_patient_update',
	mutations: ['updatePatient'],
	subject: 'patient',
	mode: 'update',
	confirm: 'standard',
	description: [
		"Show the clinician a change to this patient's contact details (phone, preferred language, barangay) as before →",
		'after. Names, birth date, sex and identifiers are not changed from chat. Only what they stated.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		phone: z.string().max(30).optional(),
		preferredLanguage: z.string().max(40).optional().describe('e.g. "Cebuano (Bisaya)".'),
		barangay: z.string().max(120).optional(),
	}),
} as const satisfies WiseActionDefinition;

export const WISE_ACTIONS = [
	proposeVitals,
	proposeAllergy,
	proposeRemoveAllergy,
	proposeResultReview,
	proposeOrder,
	proposeDiagnosis,
	proposeVoidDiagnosis,
	proposeVoidVitals,
	proposeCancelOrder,
	proposeLabOrderStep,
	proposeIssueDocument,
	proposeVoidDocument,
	proposeBillStep,
	proposeSaveReport,
	proposePatientUpdate,
] as const satisfies readonly WiseActionDefinition[];

export type WiseActionName = (typeof WISE_ACTIONS)[number]['name'];

/** The tools whose card may confirm a mutation; the mutation passes them to `WiseProposalService.verify`. */
export function wiseActionToolsFor(mutation: WiseActionMutation): string[] {
	return (WISE_ACTIONS as readonly WiseActionDefinition[])
		.filter((action) => action.mutations.includes(mutation))
		.map((action) => action.name);
}

export function wiseAction(name: string): WiseActionDefinition | undefined {
	return (WISE_ACTIONS as readonly WiseActionDefinition[]).find((action) => action.name === name);
}

/** The usual names clinicians say for the orderable tests (lower case). */
const TEST_ALIASES: Record<string, string> = {
	hba1c: '4548-4',
	a1c: '4548-4',
	'glycated hemoglobin': '4548-4',
	fbs: '1558-6',
	'fasting blood sugar': '1558-6',
	'fasting blood glucose': '1558-6',
	lipids: '57698-3',
	'lipid profile': '57698-3',
	cbc: '58410-2',
	creatinine: '2160-0',
	crea: '2160-0',
	'uric acid': '3084-1',
	alt: '1742-6',
	sgpt: '1742-6',
	potassium: '2823-3',
	urinalysis: '24356-8',
	ua: '24356-8',
	'sputum afb': '11545-1',
	afb: '11545-1',
	ecg: '11524-6',
	ekg: '11524-6',
	'chest x-ray': '36643-5',
	cxr: '36643-5',
	mammogram: '24606-6',
	mammography: '24606-6',
	'breast ultrasound': '24601-7',
};

/** Finds an orderable test by LOINC code, name or a usual abbreviation; undefined when it isn't orderable. */
export function resolveLabTest(name: string): LabTest | undefined {
	const key = name.trim().toLowerCase();
	const code = TEST_ALIASES[key] ?? key;
	return (
		LAB_TESTS.find((test) => test.code === code) ??
		LAB_TESTS.find((test) => test.display.toLowerCase() === key) ??
		LAB_TESTS.find((test) => test.display.toLowerCase().startsWith(key))
	);
}

export type ProposeVitalsInput = z.infer<typeof proposeVitals.InputSchema>;
export type ProposeAllergyInput = z.infer<typeof proposeAllergy.InputSchema>;
export type ProposeRemoveAllergyInput = z.infer<typeof proposeRemoveAllergy.InputSchema>;
export type ProposeResultReviewInput = z.infer<typeof proposeResultReview.InputSchema>;
export type ProposeOrderInput = z.infer<typeof proposeOrder.InputSchema>;
export type ProposeDiagnosisInput = z.infer<typeof proposeDiagnosis.InputSchema>;
export type ProposeVoidDiagnosisInput = z.infer<typeof proposeVoidDiagnosis.InputSchema>;
export type ProposeVoidVitalsInput = z.infer<typeof proposeVoidVitals.InputSchema>;
export type ProposeCancelOrderInput = z.infer<typeof proposeCancelOrder.InputSchema>;
export type ProposeLabOrderStepInput = z.infer<typeof proposeLabOrderStep.InputSchema>;
export type ProposeIssueDocumentInput = z.infer<typeof proposeIssueDocument.InputSchema>;
export type ProposeVoidDocumentInput = z.infer<typeof proposeVoidDocument.InputSchema>;
export type ProposeBillStepInput = z.infer<typeof proposeBillStep.InputSchema>;
export type ProposeSaveReportInput = z.infer<typeof proposeSaveReport.InputSchema>;
export type ProposePatientUpdateInput = z.infer<typeof proposePatientUpdate.InputSchema>;
