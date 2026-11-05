import type { ResultFlag, ResultValueType, Sex } from '../../../generated/prisma/enums.js';
import { ResultUrgency } from '../models/diagnostic-enums.js';

/** The parts of a `DiagnosticTestParameter` that decide a value's flag (Decimal columns as numbers). */
export interface FlaggableParameter {
	name: string;
	valueType: ResultValueType;
	options: readonly string[];
	refLowMale: number | null;
	refHighMale: number | null;
	refLowFemale: number | null;
	refHighFemale: number | null;
	refRangeText: string | null;
}

export interface ReferenceRange {
	low: number | null;
	high: number | null;
}

/** The parameter's reference range for the patient's sex (most PH labs print separate male / female ranges). */
export function referenceRangeFor(parameter: FlaggableParameter, sex: Sex): ReferenceRange {
	return sex === 'MALE'
		? { low: parameter.refLowMale, high: parameter.refHighMale }
		: { low: parameter.refLowFemale, high: parameter.refHighFemale };
}

/** The range as the result prints it (`4.0–5.6`, `< 200`, `≥ 40`), else the parameter's text range. */
export function formatReferenceRange(parameter: FlaggableParameter, sex: Sex): string | null {
	const { low, high } = referenceRangeFor(parameter, sex);
	if (low !== null && high !== null) {
		return `${low}–${high}`;
	}
	if (high !== null) {
		return `< ${high}`;
	}
	if (low !== null) {
		return `≥ ${low}`;
	}
	return parameter.refRangeText;
}

/** A numeric value as entered (`7.2`, ` 131 `); null when it is not a plain number. */
export function parseNumericValue(value: string): number | null {
	const trimmed = value.trim();
	if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) {
		return null;
	}
	return Number(trimmed);
}

/**
 * The flag of one value against its parameter, for the patient's sex: LOW / HIGH outside the numeric range, NORMAL
 * inside it; for an option analyte, ABNORMAL when it differs from the normal answer (`refRangeText`, e.g.
 * "Negative"). `critical` (the medtech calls the value in as critical) turns LOW / HIGH into CRITICAL_LOW /
 * CRITICAL_HIGH; it is refused by the caller for a value inside its range. Null when nothing can be said (free text,
 * no range).
 */
export function flagFor(parameter: FlaggableParameter, sex: Sex, value: string, critical = false): ResultFlag | null {
	if (parameter.valueType === 'NUMERIC') {
		const numeric = parseNumericValue(value);
		const { low, high } = referenceRangeFor(parameter, sex);
		if (numeric === null || (low === null && high === null)) {
			return null;
		}
		if (low !== null && numeric < low) {
			return critical ? 'CRITICAL_LOW' : 'LOW';
		}
		if (high !== null && numeric > high) {
			return critical ? 'CRITICAL_HIGH' : 'HIGH';
		}
		return 'NORMAL';
	}
	if (parameter.valueType === 'OPTION' && parameter.refRangeText) {
		return value.trim().toLowerCase() === parameter.refRangeText.trim().toLowerCase() ? 'NORMAL' : 'ABNORMAL';
	}
	return null;
}

/** Whether the flag is out of range (LOW, HIGH, ABNORMAL or critical). */
export function isAbnormal(flag: ResultFlag | null): boolean {
	return flag !== null && flag !== 'NORMAL';
}

export function isCritical(flag: ResultFlag | null): boolean {
	return flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH';
}

/**
 * The urgency of a result from its values' flags: CRITICAL if any value is, else ABNORMAL if any is out of range,
 * NORMAL when every value is flagged normal, UNFLAGGED when none carries a flag (an imaging report, free text).
 */
export function urgencyOf(flags: readonly (ResultFlag | null)[]): ResultUrgency {
	if (flags.some(isCritical)) {
		return ResultUrgency.CRITICAL;
	}
	if (flags.some(isAbnormal)) {
		return ResultUrgency.ABNORMAL;
	}
	return flags.length > 0 && flags.every((flag) => flag === 'NORMAL')
		? ResultUrgency.NORMAL
		: ResultUrgency.UNFLAGGED;
}

/** The single flag shown for a result in a list: the worst of its values. */
export function worstFlag(flags: readonly (ResultFlag | null)[]): ResultFlag | null {
	const order: ResultFlag[] = ['CRITICAL_HIGH', 'CRITICAL_LOW', 'HIGH', 'LOW', 'ABNORMAL', 'NORMAL'];
	return order.find((flag) => flags.includes(flag)) ?? null;
}
