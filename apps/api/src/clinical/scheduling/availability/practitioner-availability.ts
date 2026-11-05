import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** One of a practitioner's clinic sessions on a day, e.g. Monday 09:00–12:00 at TAG, 15-minute slots, 20 patients. */
export interface ScheduleSession {
	practitionerId: string;
	clinicId: string;
	start: Date;
	end: Date;
	slotMinutes: number;
	/** The cap per session (`max_patients`); null for no cap. */
	maxPatients: number | null;
}

/**
 * Where scheduling reads a practitioner's hours and leaves. Clinic setup owns schedules and leaves; until its
 * `PractitionerScheduleService` read methods land, `ScheduleTableAvailability` reads the `practitioner_schedules` and
 * `practitioner_leaves` tables itself. Swapping is one provider in `scheduling.module.ts`.
 */
export interface PractitionerAvailability {
	/** The practitioner's active sessions at the clinic on the Manila date `YYYY-MM-DD`, by start. */
	availabilityFor(
		tx: ClinicalTx,
		query: { practitionerId: string; clinicId: string; date: string },
	): Promise<ScheduleSession[]>;
	/** Whether a leave of the practitioner overlaps `[from, to)`. */
	isOnLeave(tx: ClinicalTx, practitionerId: string, from: Date, to: Date): Promise<boolean>;
}

export const PRACTITIONER_AVAILABILITY = Symbol('PRACTITIONER_AVAILABILITY');
