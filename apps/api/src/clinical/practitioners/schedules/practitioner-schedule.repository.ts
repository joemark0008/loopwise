import { Injectable } from '@nestjs/common';

import type { PractitionerLeave, PractitionerSchedule, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** A practitioner's link to a clinic, with whether the practitioner is still active at all. */
export type PractitionerClinicRow = Prisma.PractitionerClinicGetPayload<{
	include: { practitioner: { select: { isActive: true; deletedAt: true } } };
}>;

/**
 * `practitioner_schedules` (weekly clinic hours, staff of the clinic read them) and `practitioner_leaves` (anyone
 * signed in reads them). Every method takes the caller's transaction.
 */
@Injectable()
export class PractitionerScheduleRepository {
	findClinicLink(tx: ClinicalTx, practitionerId: string, clinicId: string): Promise<PractitionerClinicRow | null> {
		return tx.practitionerClinic.findUnique({
			where: { practitionerId_clinicId: { practitionerId, clinicId } },
			include: { practitioner: { select: { isActive: true, deletedAt: true } } },
		});
	}

	/** The practitioner's weekly sessions at the clinic (active ones only unless `includeInactive`), by day and time. */
	listSchedules(
		tx: ClinicalTx,
		where: { practitionerId?: string; clinicId: string; dayOfWeek?: number; includeInactive?: boolean },
	): Promise<PractitionerSchedule[]> {
		return tx.practitionerSchedule.findMany({
			where: {
				clinicId: where.clinicId,
				...(where.practitionerId ? { practitionerId: where.practitionerId } : {}),
				...(where.dayOfWeek === undefined ? {} : { dayOfWeek: where.dayOfWeek }),
				...(where.includeInactive ? {} : { isActive: true }),
			},
			orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
		});
	}

	/** The practitioner's active sessions on a day of week at every clinic (a doctor is in one place at a time). */
	listSessionsOnDay(tx: ClinicalTx, practitionerId: string, dayOfWeek: number): Promise<PractitionerSchedule[]> {
		return tx.practitionerSchedule.findMany({ where: { practitionerId, dayOfWeek, isActive: true } });
	}

	findSchedule(tx: ClinicalTx, id: string): Promise<PractitionerSchedule | null> {
		return tx.practitionerSchedule.findUnique({ where: { id } });
	}

	createSchedule(
		tx: ClinicalTx,
		data: Prisma.PractitionerScheduleUncheckedCreateInput,
	): Promise<PractitionerSchedule> {
		return tx.practitionerSchedule.create({ data });
	}

	updateSchedule(
		tx: ClinicalTx,
		id: string,
		data: Prisma.PractitionerScheduleUncheckedUpdateInput,
	): Promise<PractitionerSchedule> {
		return tx.practitionerSchedule.update({ where: { id }, data });
	}

	/** Deletes a weekly session (system work: users have no DELETE on schedules). */
	async deleteSchedule(tx: ClinicalTx, id: string): Promise<void> {
		await tx.practitionerSchedule.delete({ where: { id } });
	}

	/** Leaves of the practitioner that overlap `[from, to)`, by start. */
	listLeavesOverlapping(tx: ClinicalTx, practitionerId: string, from: Date, to: Date): Promise<PractitionerLeave[]> {
		return tx.practitionerLeave.findMany({
			where: { practitionerId, startAt: { lt: to }, endAt: { gt: from } },
			orderBy: { startAt: 'asc' },
		});
	}

	/** Leaves of the practitioners that end after `from`, by start. */
	listLeavesFrom(tx: ClinicalTx, practitionerIds: readonly string[], from: Date): Promise<PractitionerLeave[]> {
		return tx.practitionerLeave.findMany({
			where: { practitionerId: { in: [...practitionerIds] }, endAt: { gt: from } },
			orderBy: { startAt: 'asc' },
		});
	}

	findLeave(tx: ClinicalTx, id: string): Promise<PractitionerLeave | null> {
		return tx.practitionerLeave.findUnique({ where: { id } });
	}

	createLeave(tx: ClinicalTx, data: Prisma.PractitionerLeaveUncheckedCreateInput): Promise<PractitionerLeave> {
		return tx.practitionerLeave.create({ data });
	}

	/** Deletes a leave (system work: users have no DELETE on leaves). */
	async deleteLeave(tx: ClinicalTx, id: string): Promise<void> {
		await tx.practitionerLeave.delete({ where: { id } });
	}
}
