import type { ResultFlag, Sex } from '../../../generated/prisma/enums.js';
import type { DiagnosticTestParameterRow } from '../catalog/models/diagnostic-test.model.js';
import {
	InvalidCriticalFlagError,
	InvalidResultValueError,
	UnknownResultParameterError,
} from '../diagnostics.errors.js';
import {
	flagFor,
	type FlaggableParameter,
	formatReferenceRange,
	isCritical,
	parseNumericValue,
} from './result-flags.js';

/** One analyte as the medtech typed it. */
export interface ResultValueEntry {
	parameterId?: string | null;
	name?: string | null;
	value: string;
	unit?: string | null;
	critical?: boolean | null;
}

/** A `diagnostic_result_values` row to write: the value with the name, unit, range and flag printed at the time. */
export interface NewResultValue {
	parameterId: string | null;
	name: string;
	value: string;
	numericValue: number | null;
	unit: string | null;
	referenceRange: string | null;
	flag: ResultFlag | null;
}

export function toFlaggable(parameter: DiagnosticTestParameterRow): FlaggableParameter {
	const num = (value: DiagnosticTestParameterRow['refLowMale']) => (value === null ? null : Number(value));
	return {
		name: parameter.name,
		valueType: parameter.valueType,
		options: parameter.options,
		refLowMale: num(parameter.refLowMale),
		refHighMale: num(parameter.refHighMale),
		refLowFemale: num(parameter.refLowFemale),
		refHighFemale: num(parameter.refHighFemale),
		refRangeText: parameter.refRangeText,
	};
}

/**
 * Checks the entered values against the test's parameters and computes each flag from the parameter's reference range
 * for the patient's sex (`result-flags.ts`). Blank values are skipped; a parameter appears once; a number must be a
 * number and an option one of its answers; only an out-of-range value may be called critical. Free analytes (no
 * parameter) keep their name and unit and get no flag.
 */
export function buildResultValues(
	parameters: readonly DiagnosticTestParameterRow[],
	sex: Sex,
	entries: readonly ResultValueEntry[],
): NewResultValue[] {
	const byId = new Map(parameters.map((parameter) => [parameter.id, parameter]));
	const seen = new Set<string>();
	const values: NewResultValue[] = [];
	for (const entry of entries) {
		const value = entry.value.trim();
		if (!value) {
			continue;
		}
		if (!entry.parameterId) {
			const name = entry.name?.trim();
			if (!name || seen.has(`name:${name.toLowerCase()}`)) {
				throw new UnknownResultParameterError(name || 'An unnamed analyte');
			}
			if (entry.critical) {
				throw new InvalidCriticalFlagError(name);
			}
			seen.add(`name:${name.toLowerCase()}`);
			values.push({
				parameterId: null,
				name,
				value,
				numericValue: parseNumericValue(value),
				unit: entry.unit?.trim() || null,
				referenceRange: null,
				flag: null,
			});
			continue;
		}
		const parameter = byId.get(entry.parameterId);
		if (!parameter || seen.has(parameter.id)) {
			throw new UnknownResultParameterError(parameter?.name ?? entry.name ?? 'This analyte');
		}
		seen.add(parameter.id);
		const flaggable = toFlaggable(parameter);
		const numericValue = parameter.valueType === 'NUMERIC' ? parseNumericValue(value) : null;
		if (parameter.valueType === 'NUMERIC' && numericValue === null) {
			throw new InvalidResultValueError(parameter.name, 'a number');
		}
		const option =
			parameter.valueType === 'OPTION' && parameter.options.length > 0
				? parameter.options.find((candidate) => candidate.toLowerCase() === value.toLowerCase())
				: value;
		if (option === undefined) {
			throw new InvalidResultValueError(parameter.name, `one of ${parameter.options.join(', ')}`);
		}
		const flag = flagFor(flaggable, sex, option, entry.critical ?? false);
		if (entry.critical && !isCritical(flag)) {
			throw new InvalidCriticalFlagError(parameter.name);
		}
		values.push({
			parameterId: parameter.id,
			name: parameter.name,
			value: option,
			numericValue,
			unit: parameter.unit,
			referenceRange: formatReferenceRange(flaggable, sex),
			flag,
		});
	}
	return values;
}
