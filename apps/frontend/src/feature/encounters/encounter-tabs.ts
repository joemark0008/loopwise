/** The sections of the encounter page, as `?tab=` values. */
export const ENCOUNTER_TABS = ['note', 'vitals', 'orders', 'prescriptions', 'certificate', 'billing'] as const;
export type EncounterTab = (typeof ENCOUNTER_TABS)[number];
