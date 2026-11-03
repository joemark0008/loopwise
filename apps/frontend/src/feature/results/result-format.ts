import type { ResultItemFieldsFragment } from '@/graphql/generated/graphql';

/** The test's name as the lab sent it, else its code. */
export const testName = (result: Pick<ResultItemFieldsFragment, 'display' | 'code'>) => result.display ?? result.code;

/** `7.2 %`; a report text is cut to its first line here and shown in full on demand. */
export function resultValue(result: Pick<ResultItemFieldsFragment, 'value' | 'unit'>): string {
	const firstLine = result.value.split('\n')[0];
	return result.unit ? `${firstLine} ${result.unit}` : firstLine;
}

export const isReport = (result: Pick<ResultItemFieldsFragment, 'value'>) => result.value.includes('\n');

/** The inbox's group headings, in its order (the server sorts critical, abnormal, unflagged, normal). */
export const URGENCY_LABELS: Record<ResultItemFieldsFragment['urgency'], string> = {
	critical: 'Critical',
	abnormal: 'Abnormal',
	unflagged: 'No flag: read the report',
	normal: 'Normal',
};
