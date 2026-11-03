import type { PathwayDefinitionInput } from '@quarry/shared/pathway-rules';

/**
 * The clinical pathways (seeded by `prisma/seed-pathways.ts`) (DESIGN.md §2, §7 `Pathway`, §8), in the schema of `@quarry/shared/pathway-rules`.
 * Synthetic configuration: the thresholds follow the published guidelines cited next to them, but a pilot needs them
 * reviewed and signed off by the facility's clinicians (DESIGN.md §16). Bump a pathway's `version` whenever its rules
 * change, so every stored evaluation names the rules it came from.
 */

const ADA = 'ADA Standards of Care in Diabetes 2025, §2 (Table 2.1–2.2)';
const ADA_HYPO = 'ADA Standards of Care in Diabetes 2025, §6 (hypoglycemia levels 1–3)';
const BIRADS = 'ACR BI-RADS Atlas, 5th edition (2013): assessment categories and management';
const UKKA = 'UK Kidney Association, Treatment of Acute Hyperkalaemia in Adults (2020)';
/** A local critical-value list (DESIGN.md §4.2); each facility sets its own (CAP / CLSI GP47 practice). */
const CRITICAL_LIST = 'Loopwise synthetic critical-value list (DESIGN.md §4.2); to be set by the facility laboratory';

const HOURS_PER_DAY = 24;

export const PATHWAY_DEFINITIONS = [
	{
		key: 'diabetes',
		name: 'Diabetes (HbA1c / fasting glucose)',
		version: 2,
		rules: {
			schemaVersion: 2,
			source: `${ADA}; ${ADA_HYPO}`,
			triggers: [
				{
					code: '4548-4',
					display: 'Hemoglobin A1c',
					type: 'numeric',
					unit: '%',
					unitAliases: ['% Hb', '%HbA1c', 'NGSP %'],
					conversions: [
						{
							from: ['mmol/mol'],
							// IFCC → NGSP master equation (NGSP/IFCC network): 48 mmol/mol = 6.5 %, 39 = 5.7 %.
							factor: 0.09148,
							offset: 2.152,
							note: 'IFCC mmol/mol → NGSP %: 0.09148 × value + 2.152',
						},
					],
					bands: [
						{
							below: 5.7,
							classification: 'normal',
							urgency: 'routine',
							reason: 'HbA1c below 5.7 %: normal.',
							guideline: ADA,
							nextState: 'notified',
						},
						{
							// ADA: 5.7–6.4 % is prediabetes.
							min: 5.7,
							below: 6.5,
							classification: 'actionable',
							urgency: 'routine',
							reason: 'HbA1c 5.7–6.4 %: prediabetes range. Lifestyle counselling, retest in a year.',
							guideline: ADA,
							nextState: 'notified',
						},
						{
							// ADA: ≥ 6.5 % is the diabetes threshold; without unequivocal hyperglycemia a second
							// abnormal test confirms the diagnosis.
							min: 6.5,
							below: 10,
							classification: 'actionable',
							urgency: 'soon',
							reason: 'HbA1c ≥ 6.5 %: diabetes range. Confirm with a repeat test (ADA: two abnormal results).',
							guideline: ADA,
							nextState: 'confirming',
						},
						{
							// ADA §9: above 10 % consider starting insulin; see the patient within days.
							min: 10,
							below: 12,
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'HbA1c ≥ 10 %: markedly high. See the patient within days; treatment may start while confirming.',
							guideline: 'ADA Standards of Care in Diabetes 2025, §9 (consider insulin when A1C > 10 %)',
							nextState: 'confirming',
							slaHours: 72,
						},
						{
							// DESIGN.md §4.2 names HbA1c 12 % as a critical value for the demo.
							min: 12,
							classification: 'critical',
							urgency: 'critical',
							reason: 'HbA1c ≥ 12 %: critical value. A clinician acts today; no automated patient message.',
							guideline: CRITICAL_LIST,
							nextState: 'escalated',
						},
					],
				},
				{
					code: '1558-6',
					display: 'Fasting glucose',
					type: 'numeric',
					unit: 'mg/dL',
					unitAliases: ['mg%'],
					conversions: [
						{
							from: ['mmol/L'],
							// Glucose molar mass 180.16 g/mol: 7.0 mmol/L = 126 mg/dL.
							factor: 18.016,
							offset: 0,
							note: 'mmol/L → mg/dL: × 18.016 (glucose 180.16 g/mol)',
						},
					],
					bands: [
						{
							below: 40,
							classification: 'critical',
							urgency: 'critical',
							reason: 'Glucose below 40 mg/dL: critical hypoglycemia. A clinician acts now.',
							guideline: CRITICAL_LIST,
							nextState: 'escalated',
						},
						{
							min: 40,
							below: 54,
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'Glucose below 54 mg/dL: level 2 hypoglycemia. See the patient within a day.',
							guideline: ADA_HYPO,
							nextState: 'seen',
							slaHours: 24,
						},
						{
							min: 54,
							below: 70,
							classification: 'actionable',
							urgency: 'soon',
							reason: 'Glucose below 70 mg/dL: level 1 hypoglycemia. Review medicines and see the patient.',
							guideline: ADA_HYPO,
							nextState: 'seen',
							slaHours: 72,
						},
						{
							min: 70,
							below: 100,
							classification: 'normal',
							urgency: 'routine',
							reason: 'Fasting glucose 70–99 mg/dL: normal.',
							guideline: ADA,
							nextState: 'notified',
						},
						{
							// ADA: 100–125 mg/dL is impaired fasting glucose (prediabetes).
							min: 100,
							below: 126,
							classification: 'actionable',
							urgency: 'routine',
							reason: 'Fasting glucose 100–125 mg/dL: prediabetes (impaired fasting glucose).',
							guideline: ADA,
							nextState: 'notified',
						},
						{
							// ADA: ≥ 126 mg/dL is the diabetes threshold, confirmed by a second test.
							min: 126,
							below: 250,
							classification: 'actionable',
							urgency: 'soon',
							reason: 'Fasting glucose ≥ 126 mg/dL: diabetes range. Confirm with a repeat test.',
							guideline: ADA,
							nextState: 'confirming',
						},
						{
							min: 250,
							below: 400,
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'Fasting glucose ≥ 250 mg/dL: marked hyperglycemia. See the patient within days.',
							guideline: ADA,
							nextState: 'confirming',
							slaHours: 72,
						},
						{
							// Laboratory critical limits for glucose are commonly set at 400–500 mg/dL.
							min: 400,
							classification: 'critical',
							urgency: 'critical',
							reason: 'Glucose ≥ 400 mg/dL: critical value; check for a hyperglycemic crisis (DKA/HHS).',
							guideline: CRITICAL_LIST,
							nextState: 'escalated',
						},
					],
				},
			],
			criticalFlag: { nextState: 'escalated', slaHours: 1 },
		},
		steps: [
			{ state: 'open', label: 'Result waits for the ordering clinician to review it', slaHours: 48 },
			{ state: 'notified', label: 'Nurse tells the patient the result', slaHours: 48 },
			{ state: 'acknowledged', label: 'Patient acknowledged; confirmatory test ordered', slaHours: 48 },
			{ state: 'confirming', label: 'Confirmatory HbA1c or fasting glucose', slaHours: 14 * HOURS_PER_DAY },
			{ state: 'referred', label: 'Referred to internal medicine when needed', slaHours: 72 },
			{ state: 'accepted', label: 'Referral accepted, appointment booked', slaHours: 7 * HOURS_PER_DAY },
			{ state: 'seen', label: 'Seen by the treating clinician', slaHours: 14 * HOURS_PER_DAY },
			{
				state: 'treatment_started',
				label: 'Treatment or lifestyle programme started',
				slaHours: 30 * HOURS_PER_DAY,
			},
			{ state: 'closed', label: 'Closed with evidence or a clinician sign-off' },
		],
		slas: { resultReviewHours: 48, criticalAlertHours: 1 },
		closureRequirements: {
			anyOf: ['result', 'visit_note', 'dispense', 'signoff'],
			signoffNeedsReason: true,
			description:
				'A confirmatory result, a visit note, a dispense, or a named clinician’s sign-off with a reason.',
		},
	},
	{
		key: 'breast',
		name: 'Breast screening (mammogram, BI-RADS)',
		version: 2,
		rules: {
			schemaVersion: 2,
			source: BIRADS,
			triggers: [
				{
					code: '24606-6',
					display: 'MG Breast Screening',
					type: 'coded',
					// Imaging results arrive as text or a bare category: "BI-RADS 4", "BI-RADS Category 4A", "4".
					valuePattern: String.raw`^(?:(?:ACR\s*)?BI-?RADS)?\s*(?:category|cat\.?)?\s*[:#-]?\s*([0-6])[A-C]?\b`,
					valueLabel: 'BI-RADS',
					bands: [
						{
							values: ['1', '2'],
							classification: 'normal',
							urgency: 'routine',
							reason: 'BI-RADS 1–2: negative or benign. Routine screening.',
							guideline: BIRADS,
							nextState: 'notified',
						},
						{
							values: ['3'],
							classification: 'actionable',
							urgency: 'routine',
							reason: 'BI-RADS 3: probably benign. Short-interval (6-month) follow-up imaging.',
							guideline: BIRADS,
							nextState: 'notified',
						},
						{
							values: ['0'],
							classification: 'actionable',
							urgency: 'soon',
							reason: 'BI-RADS 0: incomplete. Recall for additional imaging (diagnostic views, ultrasound).',
							guideline: BIRADS,
							nextState: 'referred',
							slaHours: 7 * HOURS_PER_DAY,
						},
						{
							// Suspicious: the result is diagnostic enough to refer for biopsy, no confirming step.
							values: ['4'],
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'BI-RADS 4: suspicious. Refer for tissue diagnosis (biopsy).',
							guideline: BIRADS,
							nextState: 'referred',
						},
						{
							values: ['5'],
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'BI-RADS 5: highly suggestive of malignancy. Refer for biopsy now.',
							guideline: BIRADS,
							nextState: 'referred',
							slaHours: 24,
						},
						{
							values: ['6'],
							classification: 'actionable',
							urgency: 'soon',
							reason: 'BI-RADS 6: known biopsy-proven malignancy. Surgical and oncology management.',
							guideline: BIRADS,
							nextState: 'referred',
						},
					],
				},
			],
			criticalFlag: { nextState: 'escalated', slaHours: 4 },
		},
		steps: [
			{ state: 'open', label: 'Report waits for the ordering clinician to review it', slaHours: 48 },
			{ state: 'notified', label: 'Nurse tells the patient the result', slaHours: 24 },
			{ state: 'acknowledged', label: 'Patient acknowledged the next step', slaHours: 48 },
			{ state: 'referred', label: 'Referred to the hospital breast clinic', slaHours: 48 },
			{ state: 'accepted', label: 'Referral accepted, appointment booked', slaHours: 7 * HOURS_PER_DAY },
			{ state: 'seen', label: 'Seen by the specialist (biopsy or imaging)', slaHours: 14 * HOURS_PER_DAY },
			{ state: 'treatment_started', label: 'Treatment started', slaHours: 30 * HOURS_PER_DAY },
			{ state: 'closed', label: 'Closed with a visit note or a clinician sign-off' },
		],
		slas: { resultReviewHours: 48, criticalAlertHours: 4 },
		closureRequirements: {
			anyOf: ['visit_note', 'signoff'],
			signoffNeedsReason: true,
			description: 'The specialist’s visit note, or a named clinician’s sign-off with a reason.',
		},
	},
	{
		key: 'potassium',
		name: 'Potassium (hypo- / hyperkalaemia)',
		version: 1,
		rules: {
			schemaVersion: 2,
			source: UKKA,
			triggers: [
				{
					code: '2823-3',
					display: 'Potassium',
					type: 'numeric',
					unit: 'mmol/L',
					// Monovalent: 1 mEq/L = 1 mmol/L.
					unitAliases: ['mEq/L'],
					conversions: [],
					bands: [
						{
							below: 2.5,
							classification: 'critical',
							urgency: 'critical',
							reason: 'Potassium below 2.5 mmol/L: severe hypokalaemia, critical value. A clinician acts now.',
							guideline: CRITICAL_LIST,
							nextState: 'escalated',
						},
						{
							min: 2.5,
							below: 3,
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'Potassium 2.5–2.9 mmol/L: moderate hypokalaemia. See the patient within a day.',
							guideline: UKKA,
							nextState: 'seen',
							slaHours: 24,
						},
						{
							min: 3,
							below: 3.5,
							classification: 'actionable',
							urgency: 'soon',
							reason: 'Potassium 3.0–3.4 mmol/L: mild hypokalaemia. Review medicines (diuretics).',
							guideline: UKKA,
							nextState: 'seen',
							slaHours: 72,
						},
						{
							min: 3.5,
							below: 5.5,
							classification: 'normal',
							urgency: 'routine',
							reason: 'Potassium 3.5–5.4 mmol/L: no hypo- or hyperkalaemia.',
							guideline: UKKA,
							nextState: 'notified',
						},
						{
							// UKKA: mild 5.5–5.9, moderate 6.0–6.4, severe ≥ 6.5 mmol/L.
							min: 5.5,
							below: 6,
							classification: 'actionable',
							urgency: 'soon',
							reason: 'Potassium 5.5–5.9 mmol/L: mild hyperkalaemia. Repeat (rule out haemolysis), review medicines.',
							guideline: UKKA,
							nextState: 'seen',
							slaHours: 72,
						},
						{
							min: 6,
							below: 6.5,
							classification: 'actionable',
							urgency: 'urgent',
							reason: 'Potassium 6.0–6.4 mmol/L: moderate hyperkalaemia. ECG and repeat today.',
							guideline: UKKA,
							nextState: 'seen',
							slaHours: 24,
						},
						{
							// DESIGN.md §4.2 names K+ 6.5 as a critical value.
							min: 6.5,
							classification: 'critical',
							urgency: 'critical',
							reason: 'Potassium ≥ 6.5 mmol/L: severe hyperkalaemia, critical value. A clinician acts now.',
							guideline: `${UKKA}; ${CRITICAL_LIST}`,
							nextState: 'escalated',
						},
					],
				},
			],
			criticalFlag: { nextState: 'escalated', slaHours: 1 },
		},
		steps: [
			{ state: 'open', label: 'Result waits for the ordering clinician to review it', slaHours: 24 },
			{ state: 'notified', label: 'Patient told and called in', slaHours: 24 },
			{ state: 'seen', label: 'Seen; repeat test and ECG as needed', slaHours: 72 },
			{ state: 'treatment_started', label: 'Cause treated, medicines adjusted', slaHours: 14 * HOURS_PER_DAY },
			{ state: 'closed', label: 'Closed with a repeat result, a visit note or a sign-off' },
		],
		slas: { resultReviewHours: 24, criticalAlertHours: 1 },
		closureRequirements: {
			anyOf: ['result', 'visit_note', 'signoff'],
			signoffNeedsReason: true,
			description: 'A repeat potassium in range, a visit note, or a named clinician’s sign-off with a reason.',
		},
	},
] as const satisfies readonly PathwayDefinitionInput[];

export type PathwayDefinitionKey = (typeof PATHWAY_DEFINITIONS)[number]['key'];
