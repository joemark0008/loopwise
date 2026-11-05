/** Longest code a clinic name gives; document numbers carry it (e.g. `TAG-RX-2026-000123`). */
const MAX_CODE_LENGTH = 6;

/**
 * The short code of a new clinic (`clinics.code`, unique per organization), from its name: the initials of a name of
 * several words ("Tagbilaran City Health Center" → `TCHC`), else its first three letters ("Tagbilaran" → `TAG`); a
 * number is appended while the code is taken (`TAG2`, `TAG3` …).
 */
export function clinicCodeFromName(name: string, taken: ReadonlySet<string>): string {
	const words = name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toUpperCase()
		.replace(/['’]/g, '')
		.replace(/[^A-Z0-9 ]+/g, ' ')
		.split(/\s+/)
		.filter(Boolean);
	const initials = words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 3);
	const base = initials.slice(0, MAX_CODE_LENGTH) || 'CLN';
	if (!taken.has(base)) {
		return base;
	}
	for (let n = 2; ; n++) {
		const candidate = `${base}${n}`;
		if (!taken.has(candidate)) {
			return candidate;
		}
	}
}
