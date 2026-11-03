import z from 'zod/v3';

import { PATIENT_MEASURES } from './chart-patient-trend';
import { ChartSpecSchema } from './clinical-chart';

export const REPORT_TYPES = ['patient_summary', 'encounter_summary', 'facility_panel'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
	patient_summary: 'Patient clinical summary',
	encounter_summary: 'Encounter summary',
	facility_panel: 'Facility panel summary',
};

export const MAX_NARRATIVE = 1500;
export const MAX_CHARTS = 4;

export const WATERMARK = 'Synthetic data — prototype';

export const description = [
	'Build a summary report the clinician can read in the chat and download as a PDF. Types: patient_summary (a',
	"patient's demographics, allergies, problems, current medicines, vitals, labs with trend charts and encounters),",
	'encounter_summary (one visit: note, vitals, diagnoses, orders, prescriptions, certificate) and facility_panel',
	"(counts across the user's facility, no names). The server fills every data section from the record; you write",
	'only `narrative`: 3–6 sentences of clinical synthesis that refer to the sections and add no number, date, drug',
	'or diagnosis that is not in the record. A narrative with a number the sections lack is refused. Nothing is saved',
	'or sent: the clinician downloads the PDF themselves. Every report is recorded in the audit log.',
].join(' ');

export const InputSchema = z.object({
	type: z.enum(REPORT_TYPES),
	patientId: z
		.string()
		.optional()
		.describe('For patient_summary: the patient id (omit in their chart chat). Never invent one.'),
	encounterId: z
		.string()
		.optional()
		.describe('For encounter_summary: an [encounter <id>] from the patient record. Never invent one.'),
	facilityId: z
		.string()
		.optional()
		.describe('For facility_panel: one of your facilities (omit when you work at one).'),
	months: z.number().int().min(1).max(60).optional().describe('Period covered, in months (default 12).'),
	charts: z
		.array(z.enum(PATIENT_MEASURES))
		.max(MAX_CHARTS)
		.optional()
		.describe('patient_summary: trend charts to include (default blood_pressure, and hba1c when there is one).'),
	narrative: z.string().max(MAX_NARRATIVE).describe('Your 3–6 sentence clinical summary. No new numbers.'),
});

export const FactSchema = z.object({ label: z.string(), value: z.string() });

export const SectionSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('facts'), title: z.string(), facts: z.array(FactSchema) }),
	z.object({
		kind: z.literal('table'),
		title: z.string(),
		columns: z.array(z.string()),
		rows: z.array(z.array(z.string())),
		empty: z.string(),
	}),
	z.object({ kind: z.literal('chart'), title: z.string(), chart: ChartSpecSchema }),
	z.object({ kind: z.literal('text'), title: z.string(), text: z.string() }),
]);

export type Section = z.infer<typeof SectionSchema>;

/** The data of a report, frozen when Wise builds it: the PDF is printed from this, so it matches what was shown. */
export const SnapshotSchema = z.object({
	type: z.enum(REPORT_TYPES),
	title: z.string(),
	/** Who or what it is about, e.g. "Maria Santos · F · 45 y". */
	subject: z.string(),
	patientId: z.string().nullable(),
	facility: z.object({ id: z.string(), name: z.string() }).nullable(),
	generatedAt: z.string(),
	generatedBy: z.string(),
	months: z.number(),
	sections: z.array(SectionSchema),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	snapshot: SnapshotSchema,
	narrative: z.string(),
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;

const NUMBER = /\d+(?:[.,]\d+)?/g;

/** Every number in the snapshot's text, normalized (`7.20` → `7.2`), so a narrative can be checked against it. */
export function snapshotNumbers(snapshot: Snapshot): Set<string> {
	const numbers = new Set<string>();
	const add = (text: string) => {
		for (const match of text.match(NUMBER) ?? []) {
			numbers.add(normalizeNumber(match));
		}
	};
	add(snapshot.subject);
	for (const section of snapshot.sections) {
		if (section.kind === 'facts') {
			section.facts.forEach((fact) => add(fact.value));
		} else if (section.kind === 'table') {
			section.rows.forEach((row) => row.forEach(add));
		} else if (section.kind === 'chart') {
			for (const row of section.chart.rows) {
				Object.values(row).forEach((value) => value !== null && add(String(value)));
			}
		} else {
			add(section.text);
		}
	}
	return numbers;
}

/**
 * The numbers of a narrative the snapshot doesn't contain. Small counts (0–10, "3 visits", "2 weeks") and years are
 * allowed: they are words more than data. ICD-10 codes like E11.9 are checked like any other number.
 */
export function ungroundedNumbers(narrative: string, snapshot: Snapshot): string[] {
	const known = snapshotNumbers(snapshot);
	const found = (narrative.match(NUMBER) ?? []).map(normalizeNumber);
	return [...new Set(found.filter((value) => !known.has(value) && !isSmallCount(value) && !isYear(value)))];
}

const normalizeNumber = (value: string) => {
	const parsed = Number(value.replace(',', '.'));
	return Number.isFinite(parsed) ? String(parsed) : value;
};
const isSmallCount = (value: string) => /^\d+$/.test(value) && Number(value) <= 10;
const isYear = (value: string) => /^(19|20)\d\d$/.test(value);
