import z from 'zod/v3';

/**
 * Vital signs of an encounter (DESIGN.md §7): the one set of rules for the API, the vitals form and the Wise card.
 * Units are fixed (mmHg, bpm, breaths/min, °C, %, kg, cm, mg/dL); the ranges only catch typos.
 */
export const VITAL_RANGES = {
	systolicMmHg: { min: 50, max: 300, label: 'Systolic BP', unit: 'mmHg' },
	diastolicMmHg: { min: 20, max: 200, label: 'Diastolic BP', unit: 'mmHg' },
	heartRateBpm: { min: 20, max: 250, label: 'Heart rate', unit: 'bpm' },
	respiratoryRate: { min: 4, max: 80, label: 'Respiratory rate', unit: '/min' },
	temperatureC: { min: 30, max: 45, label: 'Temperature', unit: '°C' },
	spo2Pct: { min: 50, max: 100, label: 'SpO₂', unit: '%' },
	weightKg: { min: 0.5, max: 350, label: 'Weight', unit: 'kg' },
	heightCm: { min: 30, max: 250, label: 'Height', unit: 'cm' },
	bloodGlucoseMgDl: { min: 10, max: 1000, label: 'Glucose (CBG)', unit: 'mg/dL' },
	painScore: { min: 0, max: 10, label: 'Pain score', unit: '/10' },
} as const;

export type VitalField = keyof typeof VITAL_RANGES;
export const VITAL_FIELDS = Object.keys(VITAL_RANGES) as VitalField[];
const DECIMAL_FIELDS: ReadonlySet<VitalField> = new Set(['temperatureC', 'weightKg', 'heightCm']);

const emptyToUndefined = (value: unknown) =>
	value === null || (typeof value === 'string' && value.trim() === '') ? undefined : value;

function vital(field: VitalField) {
	const { min, max, label, unit } = VITAL_RANGES[field];
	let schema = z.coerce.number({ invalid_type_error: `${label} must be a number.` });
	if (!DECIMAL_FIELDS.has(field)) {
		schema = schema.int(`${label} must be a whole number.`);
	}
	return z.preprocess(
		emptyToUndefined,
		schema
			.min(min, `${label} must be at least ${min} ${unit}.`)
			.max(max, `${label} must be at most ${max} ${unit}.`)
			.optional(),
	);
}

export const VitalsDraftSchema = z
	.object({
		systolicMmHg: vital('systolicMmHg').describe('Systolic blood pressure, mmHg.'),
		diastolicMmHg: vital('diastolicMmHg').describe('Diastolic blood pressure, mmHg.'),
		heartRateBpm: vital('heartRateBpm').describe('Heart (pulse) rate, beats per minute.'),
		respiratoryRate: vital('respiratoryRate').describe('Breaths per minute.'),
		temperatureC: vital('temperatureC').describe('Body temperature, °C.'),
		spo2Pct: vital('spo2Pct').describe('Oxygen saturation, %.'),
		weightKg: vital('weightKg').describe('Weight, kg.'),
		heightCm: vital('heightCm').describe('Height, cm.'),
		bloodGlucoseMgDl: vital('bloodGlucoseMgDl').describe('Capillary blood glucose, mg/dL.'),
		painScore: vital('painScore').describe('Pain, 0–10.'),
	})
	.superRefine((value, ctx) => {
		if (VITAL_FIELDS.every((field) => value[field] === undefined)) {
			ctx.addIssue({ code: 'custom', path: ['systolicMmHg'], message: 'Enter at least one measurement.' });
		}
		if ((value.systolicMmHg === undefined) !== (value.diastolicMmHg === undefined)) {
			const path = value.systolicMmHg === undefined ? 'systolicMmHg' : 'diastolicMmHg';
			ctx.addIssue({ code: 'custom', path: [path], message: 'Enter both systolic and diastolic pressure.' });
		} else if (
			value.systolicMmHg !== undefined &&
			value.diastolicMmHg !== undefined &&
			value.diastolicMmHg >= value.systolicMmHg
		) {
			ctx.addIssue({ code: 'custom', path: ['diastolicMmHg'], message: 'Diastolic must be below systolic.' });
		}
	});

export type VitalsDraft = z.output<typeof VitalsDraftSchema>;

/** The first message of each invalid field, keyed by field name. */
export function vitalsDraftErrors(values: unknown): Partial<Record<VitalField, string>> {
	const parsed = VitalsDraftSchema.safeParse(values);
	if (parsed.success) {
		return {};
	}
	const errors: Partial<Record<VitalField, string>> = {};
	for (const issue of parsed.error.issues) {
		const field = issue.path[0] as VitalField;
		errors[field] ??= issue.message;
	}
	return errors;
}

/** kg / m², to one decimal; undefined unless both are given. */
export function computeBmi(weightKg?: number | null, heightCm?: number | null): number | undefined {
	if (!weightKg || !heightCm) {
		return undefined;
	}
	const metres = heightCm / 100;
	return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/** The Asia-Pacific BMI cut-offs (WHO WPRO 2000) used in Philippine practice. */
export function bmiCategory(bmi: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
	if (bmi < 18.5) {
		return 'underweight';
	}
	if (bmi < 23) {
		return 'normal';
	}
	return bmi < 25 ? 'overweight' : 'obese';
}

export type VitalFlag = 'critical_low' | 'low' | 'normal' | 'high' | 'critical_high';

/**
 * Adult reference ranges for flagging a measurement (not for validating input: that is `VITAL_RANGES`). `low`/`high`
 * bound the normal range; `criticalLow`/`criticalHigh` call for action now. Generic adult thresholds (BP per the
 * Philippine hypertension guideline's stage 1 at 140/90), to be confirmed by a clinician before a pilot (DESIGN.md §16).
 */
export const VITAL_REFERENCE: Partial<
	Record<VitalField, { low?: number; high?: number; criticalLow?: number; criticalHigh?: number }>
> = {
	systolicMmHg: { low: 90, high: 139, criticalLow: 80, criticalHigh: 179 },
	diastolicMmHg: { low: 60, high: 89, criticalHigh: 119 },
	heartRateBpm: { low: 60, high: 100, criticalLow: 40, criticalHigh: 130 },
	respiratoryRate: { low: 12, high: 20, criticalLow: 8, criticalHigh: 30 },
	temperatureC: { low: 36.0, high: 37.5, criticalLow: 35.0, criticalHigh: 39.9 },
	spo2Pct: { low: 95, criticalLow: 89 },
	bloodGlucoseMgDl: { low: 70, high: 199, criticalLow: 54, criticalHigh: 399 },
	painScore: { high: 3 },
};

/** Where a measurement falls against the adult reference range; null when the field has none or no value. */
export function vitalFlag(field: VitalField, value: number | null | undefined): VitalFlag | null {
	const reference = VITAL_REFERENCE[field];
	if (!reference || value === null || value === undefined) {
		return null;
	}
	if (reference.criticalLow !== undefined && value <= reference.criticalLow) {
		return 'critical_low';
	}
	if (reference.criticalHigh !== undefined && value > reference.criticalHigh) {
		return 'critical_high';
	}
	if (reference.low !== undefined && value < reference.low) {
		return 'low';
	}
	if (reference.high !== undefined && value > reference.high) {
		return 'high';
	}
	return 'normal';
}
