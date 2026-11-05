/**
 * The catalogue of Wise tools (DESIGN.md §7.3): what each one does in plain words, what kind it is, where it shows in
 * Settings → Wise tools, and whether an organization has it on by default. The API offers the model only the
 * tools turned on for the user, refuses the others, and the settings page lists them from here.
 *
 * Confirmation is not in here on purpose: every change Wise drafts needs the clinician's Confirm, always.
 */

/** Mirrors the API's tool kinds (`agent/utils/tools.ts`). */
export const WISE_TOOL_KINDS = ['read', 'navigate', 'display', 'propose'] as const;
export type WiseToolKind = (typeof WISE_TOOL_KINDS)[number];

export const WISE_TOOL_KIND_LABELS: Record<WiseToolKind, string> = {
	read: 'Reads',
	navigate: 'Navigates',
	display: 'Displays',
	propose: 'Proposes changes',
};

export const WISE_TOOL_CATEGORIES = [
	'patients',
	'scheduling',
	'encounters',
	'orders',
	'results',
	'documents',
	'billing',
	'reports',
	'analytics',
	'assistant',
] as const;
export type WiseToolCategory = (typeof WISE_TOOL_CATEGORIES)[number];

export const WISE_TOOL_CATEGORY_LABELS: Record<WiseToolCategory, string> = {
	patients: 'Patients',
	scheduling: 'Appointments and queue',
	encounters: 'Encounters',
	orders: 'Orders',
	results: 'Results',
	documents: 'Prescriptions and certificates',
	billing: 'Billing',
	reports: 'Charts and reports',
	analytics: 'Analytics',
	assistant: 'Assistant',
};

export interface WiseToolEntry {
	name: string;
	/** What the user sees, e.g. "Record vitals". */
	label: string;
	/** One plain-language line for the settings page. */
	summary: string;
	kind: WiseToolKind;
	category: WiseToolCategory;
	/** Always on, with no switch: Wise can't ask, find or show without it. */
	locked?: boolean;
	/** Listed as "Coming soon" with no switch; not a tool yet. */
	comingSoon?: boolean;
	/** On in an organization until its admin changes it. */
	defaultOn: boolean;
}

/**
 * The groups the defaults used to differ by when facilities had types. A Loopwise organization is now one or more
 * clinics with their own in-house lab, so every group is on by default; an organization admin turns tools off.
 */
const ALL = true;
/** Where clinicians see patients and write the chart. */
const CARE = true;
/** Where in-house lab staff run tests and enter results. */
const LAB = true;

export const WISE_TOOL_CATALOG: readonly WiseToolEntry[] = [
	// Patients
	{
		name: 'find_patient',
		label: 'Find a patient',
		summary: 'Searches the patients you may see, by name, birth date or identifier.',
		kind: 'read',
		category: 'patients',
		locked: true,
		defaultOn: ALL,
	},
	{
		name: 'open_page',
		label: 'Open a page',
		summary: "Opens a page of the app, such as a patient's chart.",
		kind: 'navigate',
		category: 'patients',
		locked: true,
		defaultOn: ALL,
	},
	{
		name: 'propose_patient_registration',
		label: 'Register a patient',
		summary: 'Drafts a new patient registration for you to check, record consent and confirm.',
		kind: 'propose',
		category: 'patients',
		defaultOn: CARE,
	},
	{
		name: 'propose_patient_update',
		label: 'Update contact details',
		summary: "Drafts a change to the patient's phone, language or barangay, shown before → after.",
		kind: 'propose',
		category: 'patients',
		defaultOn: CARE,
	},
	// Appointments and queue
	{
		name: 'list_appointments',
		label: "List a day's appointments",
		summary: "Lists the clinic's appointments on a day, for one doctor or all, by time.",
		kind: 'read',
		category: 'scheduling',
		defaultOn: ALL,
	},
	{
		name: 'list_queue',
		label: "Who's next",
		summary: "Lists today's queue in call order, the priority lane first.",
		kind: 'read',
		category: 'scheduling',
		defaultOn: ALL,
	},
	{
		name: 'propose_appointment',
		label: 'Book an appointment',
		summary: "Drafts a booking with a doctor; you pick the slot and confirm. The patient isn't messaged.",
		kind: 'propose',
		category: 'scheduling',
		defaultOn: ALL,
	},
	{
		name: 'propose_reschedule',
		label: 'Reschedule an appointment',
		summary: 'Drafts moving a booking to another slot or doctor, shown before → after.',
		kind: 'propose',
		category: 'scheduling',
		defaultOn: ALL,
	},
	// Encounters
	{
		name: 'propose_encounter',
		label: 'Record a new visit',
		summary: 'Drafts a new encounter with the vitals and diagnoses you state.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_encounter_note',
		label: 'Edit a visit note',
		summary: 'Drafts changes to the SOAP note of a visit, shown before → after.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_scribe_note',
		label: 'AI scribe',
		summary:
			'Drafts a whole visit from your dictation or the consult recording: SOAP note, vitals, diagnoses, prescription, tests, certificate, follow-up and a patient summary, each confirmed by you.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_vitals',
		label: 'Record vitals',
		summary: 'Drafts vital signs for a visit that already exists.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_allergy',
		label: 'Add an allergy',
		summary: "Drafts an allergy for the patient's record.",
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_remove_allergy',
		label: 'Remove an allergy',
		summary: 'Drafts the removal of an allergy recorded in error; you give the reason.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_diagnosis',
		label: 'Add or change a diagnosis',
		summary: 'Drafts an ICD-10 diagnosis for a visit, or a change to one already there.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_void_diagnosis',
		label: 'Remove a diagnosis',
		summary: 'Drafts the removal of a diagnosis entered in error; you give the reason.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	{
		name: 'propose_void_vitals',
		label: 'Remove a vitals entry',
		summary: 'Drafts the removal of vital signs entered in error; you give the reason.',
		kind: 'propose',
		category: 'encounters',
		defaultOn: CARE,
	},
	// Orders
	{
		name: 'propose_order',
		label: 'Order lab tests',
		summary: "Drafts a lab or imaging request for a visit, done by the clinic's own lab.",
		kind: 'propose',
		category: 'orders',
		defaultOn: CARE,
	},
	{
		name: 'propose_cancel_order',
		label: 'Cancel an order',
		summary: 'Drafts cancelling a test before its result is in; the lab sees your reason.',
		kind: 'propose',
		category: 'orders',
		defaultOn: CARE,
	},
	{
		name: 'list_lab_orders',
		label: 'Lab worklist',
		summary: "Lists the tests on the clinic's lab worklist, by step.",
		kind: 'read',
		category: 'orders',
		defaultOn: LAB,
	},
	{
		name: 'propose_lab_order_step',
		label: 'Collect, start, release or cancel tests',
		summary: 'Drafts the next step of a test on the lab worklist; cancelling needs a reason.',
		kind: 'propose',
		category: 'orders',
		defaultOn: LAB,
	},
	// Results
	{
		name: 'list_results_to_review',
		label: 'List results to review',
		summary: 'Lists the released results waiting for your review, critical first.',
		kind: 'read',
		category: 'results',
		defaultOn: CARE,
	},
	{
		name: 'propose_result_review',
		label: 'Review a result',
		summary: 'Drafts marking a result reviewed; a critical result needs your note and a second click.',
		kind: 'propose',
		category: 'results',
		defaultOn: CARE,
	},
	// Documents
	{
		name: 'propose_prescription',
		label: 'Draft a prescription',
		summary: 'Drafts a prescription for a visit, with allergy warnings. You issue it yourself.',
		kind: 'propose',
		category: 'documents',
		defaultOn: CARE,
	},
	{
		name: 'propose_medical_certificate',
		label: 'Draft a medical certificate',
		summary: 'Drafts a medical certificate for a visit. You issue it yourself.',
		kind: 'propose',
		category: 'documents',
		defaultOn: CARE,
	},
	{
		name: 'propose_issue_document',
		label: 'Issue a prescription or certificate',
		summary: 'Drafts signing a draft under your PRC license; you confirm twice.',
		kind: 'propose',
		category: 'documents',
		defaultOn: CARE,
	},
	{
		name: 'propose_void_document',
		label: 'Void a prescription or certificate',
		summary: 'Drafts voiding a document; you give the reason.',
		kind: 'propose',
		category: 'documents',
		defaultOn: CARE,
	},
	// Billing
	{
		name: 'propose_charges',
		label: 'Draft an invoice',
		summary: 'Drafts the invoice of a visit, with the SC/PWD discount if shown. You issue it yourself.',
		kind: 'propose',
		category: 'billing',
		defaultOn: CARE,
	},
	{
		name: 'propose_bill_step',
		label: 'Issue, pay or void an invoice',
		summary: 'Drafts the next step of an invoice: issue (confirm twice), a payment with its OR number, or void.',
		kind: 'propose',
		category: 'billing',
		defaultOn: CARE,
	},
	// Charts and reports
	{
		name: 'chart_patient_trend',
		label: "Chart a patient's trend",
		summary: "Charts one patient's BP, weight, glucose or HbA1c over time.",
		kind: 'read',
		category: 'reports',
		defaultOn: ALL,
	},
	{
		name: 'create_report',
		label: 'Summary reports',
		summary: 'Builds a patient, visit or facility summary you can download as PDF.',
		kind: 'read',
		category: 'reports',
		defaultOn: ALL,
	},
	{
		name: 'report',
		label: 'Report panel',
		summary: 'Writes a report in the side panel from results already in the chat.',
		kind: 'display',
		category: 'reports',
		defaultOn: ALL,
	},
	{
		name: 'propose_save_report',
		label: 'Save a report to the chart',
		summary: "Drafts saving a report version to the patient's documents.",
		kind: 'propose',
		category: 'reports',
		defaultOn: CARE,
	},
	// Analytics
	{
		name: 'describe_analytics',
		label: 'Describe the data',
		summary: 'Lists the analytics views and metrics Wise can use.',
		kind: 'read',
		category: 'analytics',
		defaultOn: ALL,
	},
	{
		name: 'run_analytics_sql',
		label: 'Analytics questions',
		summary: 'Answers questions about your patients with one checked query, run as you.',
		kind: 'read',
		category: 'analytics',
		defaultOn: ALL,
	},
	{
		name: 'get_metric',
		label: 'Certified metrics',
		summary: 'Reads a certified metric, such as encounters per month or billing totals.',
		kind: 'read',
		category: 'analytics',
		defaultOn: ALL,
	},
	// Assistant
	{
		name: 'clarification',
		label: 'Ask you a question',
		summary: 'Asks you to choose when something is unclear.',
		kind: 'display',
		category: 'assistant',
		locked: true,
		defaultOn: ALL,
	},
	{
		name: 'read_attachment',
		label: 'Read attached files',
		summary: 'Reads a file you attach to a message (PDF, Word, CSV, text), with OCR for scanned pages.',
		kind: 'read',
		category: 'assistant',
		locked: true,
		defaultOn: ALL,
	},
	{
		name: 'suggest_follow_ups',
		label: 'Suggest follow-ups',
		summary: 'Offers a few next questions after an answer.',
		kind: 'display',
		category: 'assistant',
		defaultOn: ALL,
	},
	{
		name: 'load_skill',
		label: 'Use skills',
		summary: 'Reads the clinical guidelines and playbooks (skills) of this workspace.',
		kind: 'read',
		category: 'assistant',
		defaultOn: ALL,
	},
	{
		name: 'propose_skill',
		label: 'Draft a skill',
		summary: 'Drafts a new skill for an admin to save.',
		kind: 'propose',
		category: 'assistant',
		defaultOn: ALL,
	},
	{
		name: 'web_search',
		label: 'Search the web',
		summary: 'Searches the web, when web search is on for the workspace.',
		kind: 'read',
		category: 'assistant',
		defaultOn: ALL,
	},
	{
		name: 'web_fetch',
		label: 'Read a web page',
		summary: 'Reads a web page, when web search is on for the workspace.',
		kind: 'read',
		category: 'assistant',
		defaultOn: ALL,
	},
];

const BY_NAME = new Map(WISE_TOOL_CATALOG.map((entry) => [entry.name, entry]));

export function wiseToolEntry(name: string): WiseToolEntry | undefined {
	return BY_NAME.get(name);
}

/** The tools that can't be turned off. */
export const LOCKED_WISE_TOOLS: readonly string[] = WISE_TOOL_CATALOG.filter((entry) => entry.locked).map(
	(entry) => entry.name,
);

/** Whether an organization has the tool on before its admin changes it. Unknown tools are off. */
export function isWiseToolOnByDefault(name: string): boolean {
	const entry = BY_NAME.get(name);
	return !!entry && !entry.comingSoon && (entry.locked || entry.defaultOn);
}

/** What Wise says, and the API answers, when a tool is turned off. */
export function wiseToolOffMessage(name: string, organizationName?: string): string {
	const label = BY_NAME.get(name)?.label ?? name;
	return (
		`That action (${label}) is turned off in Wise settings${organizationName ? ` at ${organizationName}` : ''}. ` +
		'An organization admin can turn it on in Settings → Wise tools.'
	);
}
