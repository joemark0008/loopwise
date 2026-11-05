import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { manilaAt, weekday } from '../manila-time.js';
import type { PractitionerAvailability, ScheduleSession } from './practitioner-availability.js';
import { ScheduleRepository } from './schedule.repository.js';

/** `PractitionerAvailability` straight from the `practitioner_schedules` / `practitioner_leaves` tables. */
@Injectable()
export class ScheduleTableAvailability implements PractitionerAvailability {
	constructor(private readonly schedules: ScheduleRepository) {}

	async availabilityFor(
		tx: ClinicalTx,
		query: { practitionerId: string; clinicId: string; date: string },
	): Promise<ScheduleSession[]> {
		const rows = await this.schedules.sessionsOn(tx, {
			practitionerId: query.practitionerId,
			clinicId: query.clinicId,
			dayOfWeek: weekday(query.date),
		});
		return rows.map((row) => ({
			practitionerId: row.practitionerId,
			clinicId: row.clinicId,
			start: manilaAt(query.date, row.startTime),
			end: manilaAt(query.date, row.endTime),
			slotMinutes: row.slotMinutes,
			maxPatients: row.maxPatients,
		}));
	}

	isOnLeave(tx: ClinicalTx, practitionerId: string, from: Date, to: Date): Promise<boolean> {
		return this.schedules.hasLeave(tx, practitionerId, from, to);
	}
}
