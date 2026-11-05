import { Injectable } from '@nestjs/common';

import type { PractitionerSchedule } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/**
 * Read-only access to the schedules and leaves tables (owned by clinic setup), for `ScheduleTableAvailability` until
 * clinic setup exports its own read methods.
 */
@Injectable()
export class ScheduleRepository {
	/** Active weekly sessions of the practitioner at the clinic on a day of the week (0 = Sunday). */
	sessionsOn(
		tx: ClinicalTx,
		query: { practitionerId: string; clinicId: string; dayOfWeek: number },
	): Promise<PractitionerSchedule[]> {
		return tx.practitionerSchedule.findMany({
			where: { ...query, isActive: true },
			orderBy: { startTime: 'asc' },
		});
	}

	/** Whether a leave overlaps `[from, to)`. */
	async hasLeave(tx: ClinicalTx, practitionerId: string, from: Date, to: Date): Promise<boolean> {
		const count = await tx.practitionerLeave.count({
			where: { practitionerId, startAt: { lt: to }, endAt: { gt: from } },
		});
		return count > 0;
	}
}
