import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

/** The most follow-ups one list returns. */
export const FOLLOW_UP_LIMIT = 300;

const FOLLOW_UP_INCLUDE = {
	patient: {
		select: { id: true, firstName: true, middleName: true, lastName: true, patientNo: true, mobileNo: true },
	},
	practitioner: {
		select: {
			id: true,
			title: true,
			firstName: true,
			middleName: true,
			lastName: true,
			suffix: true,
			postNominals: true,
		},
	},
	diagnosis: {
		where: { voidedAt: null },
		select: { icd10Code: true, description: true, type: true },
		orderBy: { sortOrder: 'asc' },
	},
} satisfies Prisma.EncounterInclude;

/** A visit with a follow-up date, its patient, doctor and diagnoses. */
export type FollowUpRow = Prisma.EncounterGetPayload<{ include: typeof FOLLOW_UP_INCLUDE }>;

/**
 * Follow-ups are visits (`encounters.follow_up_date`), computed live, never stored. Every method takes the caller's
 * transaction: `asUser` (row-level security picks the patients, also inside the subqueries) or `asSystem` for a
 * clinic admin's whole list.
 */
@Injectable()
export class FollowUpRepository {
	/**
	 * The visits at the clinic whose follow-up date falls in `[from, to]` (Manila calendar dates), not cancelled, and
	 * not followed up yet: no later visit of the patient with the same doctor, and no later booking with that doctor
	 * that still stands (cancelled, no-show and rescheduled ones don't count; the visit's own booking neither). Oldest
	 * follow-up date first.
	 */
	async listDue(
		tx: ClinicalTx,
		filter: {
			clinicId: string;
			from: string;
			to: string;
			practitionerId?: string | null;
			patientId?: string | null;
		},
	): Promise<FollowUpRow[]> {
		const practitionerId = filter.practitionerId ?? null;
		const patientId = filter.patientId ?? null;
		const ids = await tx.$queryRaw<{ id: string }[]>`
			SELECT e.id
			FROM encounters e
			WHERE e.clinic_id = ${filter.clinicId}::uuid
				AND e.follow_up_date IS NOT NULL
				AND e.follow_up_date BETWEEN ${filter.from}::date AND ${filter.to}::date
				AND e.status <> 'CANCELLED'
				AND (${practitionerId}::uuid IS NULL OR e.practitioner_id = ${practitionerId}::uuid)
				AND (${patientId}::uuid IS NULL OR e.patient_id = ${patientId}::uuid)
				AND NOT EXISTS (
					SELECT 1 FROM encounters later
					WHERE later.patient_id = e.patient_id
						AND later.practitioner_id IS NOT DISTINCT FROM e.practitioner_id
						AND later.started_at > e.started_at
						AND later.status <> 'CANCELLED'
				)
				AND NOT EXISTS (
					SELECT 1 FROM appointments a
					WHERE a.patient_id = e.patient_id
						AND a.practitioner_id IS NOT DISTINCT FROM e.practitioner_id
						AND a.id IS DISTINCT FROM e.appointment_id
						AND a.scheduled_start > e.started_at
						AND a.status NOT IN ('CANCELLED', 'NO_SHOW', 'RESCHEDULED')
				)
			ORDER BY e.follow_up_date, e.started_at
			LIMIT ${FOLLOW_UP_LIMIT}`;
		if (ids.length === 0) {
			return [];
		}
		return tx.encounter.findMany({
			where: { id: { in: ids.map((row) => row.id) } },
			include: FOLLOW_UP_INCLUDE,
			orderBy: [{ followUpDate: 'asc' }, { startedAt: 'asc' }],
		});
	}
}
