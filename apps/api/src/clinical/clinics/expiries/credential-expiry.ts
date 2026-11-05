/**
 * Which licenses and accreditations run out soon: a practitioner's PRC license, S2 license and PhilHealth PAN, and the
 * clinic's DOH License to Operate and PhilHealth accreditation. Pure; dates are calendar dates `YYYY-MM-DD`.
 */

export const CREDENTIAL_KINDS = [
	'PRC_LICENSE',
	'S2_LICENSE',
	'PHILHEALTH_PAN',
	'DOH_LICENSE',
	'PHILHEALTH_ACCREDITATION',
] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export const CREDENTIAL_LABELS: Record<CredentialKind, string> = {
	PRC_LICENSE: 'PRC license',
	S2_LICENSE: 'S2 license (PDEA)',
	PHILHEALTH_PAN: 'PhilHealth PAN',
	DOH_LICENSE: 'DOH License to Operate',
	PHILHEALTH_ACCREDITATION: 'PhilHealth accreditation',
};

/** The default warning window. */
export const EXPIRY_WARNING_DAYS = 60;

export interface Credential {
	kind: CredentialKind;
	subjectType: 'PRACTITIONER' | 'CLINIC';
	subjectId: string;
	subjectName: string;
	number: string | null;
	/** `YYYY-MM-DD`; credentials without an expiry are never listed. */
	expiresOn: string | null;
}

export interface ExpiringCredential extends Credential {
	expiresOn: string;
	/** Days from `today` to the expiry (negative once expired). */
	daysLeft: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from `from` to `to` (calendar dates). */
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The credentials that expire within `withinDays` of `today`, expired ones included, soonest first. */
export function expiringCredentials(
	credentials: readonly Credential[],
	today: string,
	withinDays: number = EXPIRY_WARNING_DAYS,
): ExpiringCredential[] {
	return credentials
		.flatMap((credential) =>
			credential.expiresOn ? [{ ...credential, expiresOn: credential.expiresOn, daysLeft: 0 }] : [],
		)
		.map((credential) => ({ ...credential, daysLeft: daysBetween(today, credential.expiresOn) }))
		.filter((credential) => credential.daysLeft <= withinDays)
		.sort((a, b) => a.daysLeft - b.daysLeft || a.subjectName.localeCompare(b.subjectName));
}
