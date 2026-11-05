import { Injectable } from '@nestjs/common';

import { PractitionerScheduleService } from '../../practitioners/schedules/practitioner-schedule.service.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import type { PractitionerAvailability, ScheduleSession } from './practitioner-availability.js';

/**
 * `PractitionerAvailability` from clinic setup's `PractitionerScheduleService`: the weekly sessions of the date (none
 * when the practitioner no longer holds clinic there), and its leave check. Booking cuts the slots and counts
 * `maxPatients` itself.
 */
@Injectable()
export class PractitionerScheduleAvailability implements PractitionerAvailability {
	constructor(private readonly schedules: PractitionerScheduleService) {}

	async availabilityFor(
		tx: ClinicalTx,
		query: { practitionerId: string; clinicId: string; date: string },
	): Promise<ScheduleSession[]> {
		const day = await this.schedules.availabilityFor(tx, query.practitionerId, query.clinicId, query.date);
		return day.sessions.map((session) => ({
			practitionerId: query.practitionerId,
			clinicId: query.clinicId,
			start: session.startsAt,
			end: session.endsAt,
			slotMinutes: session.slotMinutes,
			maxPatients: session.maxPatients,
		}));
	}

	isOnLeave(tx: ClinicalTx, practitionerId: string, from: Date, to: Date): Promise<boolean> {
		return this.schedules.isOnLeave(tx, practitionerId, from, to);
	}
}
