import z from 'zod/v3';

import { ChartSpecSchema } from './clinical-chart';

export const PATIENT_MEASURES = [
	'blood_pressure',
	'weight_bmi',
	'heart_rate',
	'capillary_glucose',
	'hba1c',
	'fbs',
] as const;

export type PatientMeasure = (typeof PATIENT_MEASURES)[number];

export const MEASURE_LABELS: Record<PatientMeasure, string> = {
	blood_pressure: 'Blood pressure',
	weight_bmi: 'Weight and BMI',
	heart_rate: 'Heart rate',
	capillary_glucose: 'Capillary blood glucose',
	hba1c: 'HbA1c',
	fbs: 'Fasting blood sugar',
};

export const MAX_MONTHS = 60;

export const description = [
	"Chart one patient's vitals or lab results over time, from their record, as the user. Measures: blood_pressure",
	'(systolic/diastolic, with the 140/90 threshold), weight_bmi, heart_rate, capillary_glucose (vitals),',
	'hba1c (with the 6.5% diabetes threshold) and fbs (with 126 mg/dL). The chart is shown to the user and you get the',
	'points back: describe the trend only from them. In a chart chat patientId defaults to that patient; otherwise use',
	'an id find_patient returned. Every chart is recorded in the audit log.',
].join(' ');

export const InputSchema = z.object({
	measure: z.enum(PATIENT_MEASURES),
	patientId: z.string().optional().describe("The patient's id; omit in a patient's chart chat."),
	months: z.number().int().min(1).max(MAX_MONTHS).optional().describe('How far back, in months (default 12).'),
});

export const OutputSchema = z.object({
	_version: z.literal('1').optional(),
	measure: z.enum(PATIENT_MEASURES),
	patient: z.object({ id: z.string(), name: z.string() }),
	months: z.number(),
	asOf: z.string(),
	chart: ChartSpecSchema,
});

export type Input = z.infer<typeof InputSchema>;
export type Output = z.infer<typeof OutputSchema>;
