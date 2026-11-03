/** One field of an update card: what the record holds now and what Confirm would save. */
export interface FieldChange {
	key: string;
	label: string;
	before: string | null;
	after: string | null;
	changed: boolean;
}

/**
 * The fields of a record before and after a proposed change, in `labels` order. Blank and missing count as empty, and
 * surrounding whitespace is ignored, so only a real change shows as one.
 */
export function diffFields<K extends string>(
	before: Partial<Record<K, string | null | undefined>>,
	after: Partial<Record<K, string | null | undefined>>,
	labels: Record<K, string>,
): FieldChange[] {
	return (Object.keys(labels) as K[]).map((key) => {
		const was = normalize(before[key]);
		const will = normalize(after[key]);
		return { key, label: labels[key], before: was, after: will, changed: was !== will };
	});
}

const normalize = (value: string | null | undefined): string | null => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
};
