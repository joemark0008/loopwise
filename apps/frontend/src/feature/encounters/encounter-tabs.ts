/** The sections of the encounter page, as `?tab=` values. */
export const ENCOUNTER_TABS = [
	'note',
	'scribe',
	'vitals',
	'orders',
	'prescriptions',
	'certificate',
	'referrals',
	'billing',
] as const;
export type EncounterTab = (typeof ENCOUNTER_TABS)[number];
