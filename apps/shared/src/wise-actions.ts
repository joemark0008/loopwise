import z from 'zod/v3';

import { ALLERGY_SEVERITIES, ALLERGY_TYPES, DIAGNOSIS_TYPES } from './encounter-record';
import { PAYMENT_METHODS } from './invoice';
import { LAB_TESTS } from './lab-tests';
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
export const WISE_ACTION_SUBJECTS = ['encounter', 'patient', 'result', 'order', 'report', 'appointment'] as const;
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
	'createDiagnosticOrder',
	'addDiagnosis',
	'updateDiagnosis',
	'voidDiagnosis',
	'voidVitals',
	'cancelDiagnosticOrder',
	'markSpecimenCollected',
	'startDiagnosticOrderItem',
	'releaseDiagnosticResult',
	'issuePrescription',
	'voidPrescription',
	'issueMedicalCertificate',
	'voidMedicalCertificate',
	'issueInvoice',
	'recordPayment',
	'voidInvoice',
	'saveReportToChart',
	'updatePatient',
	'bookAppointment',
	'rescheduleAppointment',
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
	/** `propose_order`: the standard tests Wise resolved from the clinician's words, by catalog code. */
	tests: z.array(z.object({ code: z.string(), display: z.string(), category: z.string() })).optional(),
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
		'what they stated: the allergen, and the reaction and severity if they said.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		allergen: z.string().max(120).describe('e.g. "Penicillin", "Shrimp".'),
		type: z.enum(ALLERGY_TYPES).optional().describe('Default DRUG.'),
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
		'a card where they give the reason and confirm twice. Name the allergen as it is recorded. It stays in the record,',
		'struck through.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		allergen: z.string().max(120).describe('The recorded allergy to remove, e.g. "Penicillin".'),
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
	mutations: ['createDiagnosticOrder'],
	subject: 'encounter',
	mode: 'create',
	confirm: 'standard',
	description: [
		"Show the clinician a lab or imaging request for a visit that exists (one order, done by the clinic's own lab),",
		"in a card they can edit and confirm. Use the encounter id from the patient record (today's visit unless they",
		'name another). Name each test as the clinician said it (e.g. "HbA1c", "FBS", "lipid profile", "chest x-ray");',
		`the standard tests are: ${LAB_TESTS.map((test) => test.display).join(', ')}.`,
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		tests: z.array(z.string()).min(1).max(MAX_ORDER_TESTS).describe('Test names, catalog codes or LOINC codes.'),
		priority: z.enum(['routine', 'urgent', 'stat']).optional().describe('Default routine.'),
		clinicalInfo: z
			.string()
			.max(500)
			.optional()
			.describe(
				'The indication printed on the request (e.g. "T2DM, on metformin"), only if the clinician gave it.',
			),
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
		'cancel. If the visit already has that code, the card changes its type, finality or notes instead. Only',
		'diagnoses the clinician stated or agreed to.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		icd10Code: z.string().max(10).describe('ICD-10 (WHO 2010), e.g. "E11.9".'),
		description: z.string().max(300).describe('The diagnosis, normally the ICD-10 title.'),
		type: z
			.enum(DIAGNOSIS_TYPES)
			.optional()
			.describe('PRIMARY (one per visit), SECONDARY, WORKING (impression) or COMORBIDITY; default by the visit.'),
		isFinal: z.boolean().optional().describe('False for a provisional diagnosis still being worked up.'),
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
	mutations: ['cancelDiagnosticOrder'],
	subject: 'encounter',
	mode: 'destructive',
	confirm: 'reason',
	description: [
		'Show the clinician the cancellation of one test ordered on a visit, before its result is in; the lab sees the',
		'reason. Name the test as ordered.',
		RULES,
	].join(' '),
	InputSchema: z.object({ encounterId: EncounterIdSchema, test: z.string().max(200), reason: reasonField }),
} as const satisfies WiseActionDefinition;

export const LAB_ORDER_STEPS = ['collect', 'start', 'release', 'cancel'] as const;

export const proposeLabOrderStep = {
	name: 'propose_lab_order_step',
	mutations: [
		'markSpecimenCollected',
		'startDiagnosticOrderItem',
		'releaseDiagnosticResult',
		'cancelDiagnosticOrder',
	],
	subject: 'order',
	mode: 'update',
	confirm: 'standard',
	patientChat: false,
	description: [
		"For the clinic's lab staff (medtech, radtech): show a card that moves one test on the lab worklist: mark the",
		'specimen collected, start the run, release the entered result to the doctor, or cancel it with the reason the',
		'doctor sees. Use the item id from list_lab_orders. One test per card. Results are entered on the worklist page,',
		'never from chat.',
		RULES.replace(' Only available in a patient chart chat.', ''),
	].join(' '),
	InputSchema: z.object({
		itemId: z.string().describe('The item id of the test, from list_lab_orders.'),
		step: z.enum(LAB_ORDER_STEPS),
		accessionNo: z.string().max(60).optional().describe('For collect: the specimen label, if the user gave it.'),
		reason: z.string().max(500).optional().describe('For cancel: why, as the user said.'),
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

export const BILL_STEPS = ['issue', 'pay', 'void'] as const;

export const proposeBillStep = {
	name: 'propose_bill_step',
	mutations: ['issueInvoice', 'recordPayment', 'voidInvoice'],
	subject: 'encounter',
	mode: 'update',
	confirm: 'standard',
	description: [
		"Show the clinician a card for the next step of a visit's invoice: issue the draft (numbered and locked after;",
		'they confirm twice), record a payment (method, amount, the official receipt or reference number; PhilHealth',
		'package coverage is a PHILHEALTH payment with the package code as reference), or void it with a reason. Draft',
		'or change the lines first with propose_charges.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		encounterId: EncounterIdSchema,
		step: z.enum(BILL_STEPS),
		method: z.enum(PAYMENT_METHODS).optional().describe('For pay: how it was paid (default CASH).'),
		amount: z.number().optional().describe('For pay: pesos paid, only if stated (default the balance).'),
		tenderedAmount: z.number().optional().describe('For pay in cash: the amount handed over, only if stated.'),
		referenceNo: z
			.string()
			.max(60)
			.optional()
			.describe('For pay: the OR number, e-wallet reference or PhilHealth package code, as the clinician said.'),
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
		"Show the clinician a change to this patient's contact details (mobile, preferred language, barangay, street",
		'address) as before →',
		'after. Names, birth date, sex and identifiers are not changed from chat. Only what they stated.',
		RULES,
	].join(' '),
	InputSchema: z.object({
		phone: z.string().max(30).optional(),
		preferredLanguage: z.string().max(40).optional().describe('e.g. "Cebuano (Bisaya)".'),
		barangay: z
			.string()
			.max(120)
			.optional()
			.describe("The barangay's name in the clinic's city, or its PSGC code."),
		addressLine: z.string().max(300).optional().describe('House no., street, purok / sitio.'),
	}),
} as const satisfies WiseActionDefinition;

export const VISIT_TYPES = ['NEW_PATIENT', 'FOLLOW_UP', 'PROCEDURE', 'TELECONSULT', 'PEME', 'APE'] as const;
export const BOOKING_CHANNELS = [
	'WALK_IN',
	'PHONE',
	'SMS',
	'FACEBOOK_MESSENGER',
	'VIBER',
	'ONLINE_PORTAL',
	'REFERRAL',
] as const;

const BOOKING_RULES = [
	"The card shows the doctor's open slots that day and the front desk picks or changes the time; Confirm books it.",
	'Never send the patient a message about it yourself.',
	RULES,
].join(' ');

export const proposeAppointment = {
	name: 'propose_appointment',
	mutations: ['bookAppointment'],
	subject: 'patient',
	mode: 'create',
	confirm: 'standard',
	description: [
		"Show the front desk a booking for this patient with a doctor of this chat's clinic, in a card they can edit,",
		'confirm or cancel ("Book Maria with Dr. Reyes next Tuesday morning"). Give the date the user meant as',
		'YYYY-MM-DD (Asia/Manila) and the time they asked for, if any.',
		BOOKING_RULES,
	].join(' '),
	InputSchema: z.object({
		doctor: z.string().max(80).describe('Words of the doctor\'s name, e.g. "Reyes".'),
		date: z.string().describe('YYYY-MM-DD (Asia/Manila).'),
		time: z.string().max(5).optional().describe('HH:MM (24 h) if the user said a time.'),
		partOfDay: z.enum(['morning', 'afternoon']).optional().describe('If the user said morning or afternoon.'),
		visitType: z.enum(VISIT_TYPES).optional().describe('Default NEW_PATIENT; FOLLOW_UP for a return visit.'),
		channel: z.enum(BOOKING_CHANNELS).optional().describe('How the patient asked: phone, SMS, Messenger …'),
		reason: z.string().max(400).optional().describe("Why they're coming, in the user's words."),
	}),
} as const satisfies WiseActionDefinition;

export const proposeReschedule = {
	name: 'propose_reschedule',
	mutations: ['rescheduleAppointment'],
	subject: 'appointment',
	mode: 'update',
	confirm: 'standard',
	description: [
		"Show the front desk a move of one of this patient's upcoming appointments (the id from list_appointments) to",
		'another day or time, or another doctor, in a card showing before → after. Use it when the doctor is out or the',
		'patient asked to move it.',
		BOOKING_RULES,
	].join(' '),
	InputSchema: z.object({
		appointmentId: z.string().describe('The appointment id from list_appointments.'),
		date: z.string().describe('The new day, YYYY-MM-DD (Asia/Manila).'),
		time: z.string().max(5).optional().describe('HH:MM (24 h) if the user said a time.'),
		partOfDay: z.enum(['morning', 'afternoon']).optional(),
		doctor: z.string().max(80).optional().describe('Another doctor, if the user named one.'),
		reason: z.string().max(300).optional().describe('Why, e.g. "Dr. Reyes is at a conference".'),
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
	proposeAppointment,
	proposeReschedule,
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
export type ProposeAppointmentInput = z.infer<typeof proposeAppointment.InputSchema>;
export type ProposeRescheduleInput = z.infer<typeof proposeReschedule.InputSchema>;
