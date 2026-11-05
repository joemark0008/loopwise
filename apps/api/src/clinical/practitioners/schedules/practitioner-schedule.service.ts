import { Injectable } from '@nestjs/common';

import type { PractitionerSchedule } from '../../../generated/prisma/client.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { InvalidScheduleError } from '../practitioners.errors.js';
import {
	dayOfWeekOf,
	isDateOnly,
	manilaDayRange,
	overlapsLeave,
	sessionsOn,
	type WeeklySession,
} from './availability.js';
import {
	type PractitionerAvailability,
	type PractitionerLeave,
	toAvailabilitySession,
	toLeaveWindow,
	toPractitionerLeave,
} from './models/practitioner-availability.model.js';
import { PractitionerScheduleRepository } from './practitioner-schedule.repository.js';

/**
 * Reads a practitioner's weekly clinic hours and leaves, for booking (the `scheduling` module) and for Wise ("which
 * doctors are in today"). Read-only and on the caller's transaction (`ClinicalDbService.asUser`, so the clinic's
 * schedules are only read by its staff); the clinic setup writes them through `PractitionerSetupService`.
 */
@Injectable()
export class PractitionerScheduleService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly schedules: PractitionerScheduleRepository,
	) {}

	/** `availabilityFor` as the user (row-level security: staff of the clinic). */
	availabilityForUser(
		userId: string,
		practitionerId: string,
		clinicId: string,
		date: string,
	): Promise<PractitionerAvailability> {
		return this.db.asUser(userId, (tx) => this.availabilityFor(tx, practitionerId, clinicId, date));
	}

	/**
	 * The practitioner's day at the clinic: the weekly sessions of `date`'s day of week (Philippine calendar date,
	 * `YYYY-MM-DD`), cut into slots of the session's `slotMinutes`, without the slots a leave overlaps. No sessions
	 * when the practitioner doesn't hold clinic there (`practicesHere` false). Booking still has to count the
	 * appointments already in a slot and the session's `maxPatients`.
	 */
	async availabilityFor(
		tx: ClinicalTx,
		practitionerId: string,
		clinicId: string,
		date: string,
	): Promise<PractitionerAvailability> {
		if (!isDateOnly(date)) {
			throw new InvalidScheduleError(`${date} is not a date (YYYY-MM-DD).`);
		}
		const dayOfWeek = dayOfWeekOf(date);
		const { from, to } = manilaDayRange(date);
		// One after the other: a transaction's queries share one connection.
		const link = await this.schedules.findClinicLink(tx, practitionerId, clinicId);
		const practicesHere = Boolean(link?.isActive && link.practitioner.isActive && !link.practitioner.deletedAt);
		const weekly = practicesHere
			? await this.schedules.listSchedules(tx, { practitionerId, clinicId, dayOfWeek })
			: [];
		const leaves = await this.schedules.listLeavesOverlapping(tx, practitionerId, from, to);
		const sessions = sessionsOn(date, weekly.map(toWeeklySession), leaves.map(toLeaveWindow));
		return {
			practitionerId,
			clinicId,
			date,
			dayOfWeek,
			practicesHere,
			onLeave: leaves.length > 0,
			leaves: leaves.map(toPractitionerLeave),
			sessions: sessions.map(toAvailabilitySession),
		};
	}

	/**
	 * Whether the practitioner is on leave at an instant (`from` alone) or at any time in `[from, to)` (a booking's
	 * slot).
	 */
	async isOnLeave(tx: ClinicalTx, practitionerId: string, from: Date, to: Date = from): Promise<boolean> {
		const end = to.getTime() > from.getTime() ? to : new Date(from.getTime() + 1);
		const leaves = await this.schedules.listLeavesOverlapping(tx, practitionerId, from, end);
		return leaves.some((leave) => overlapsLeave(leave, from, to));
	}

	/** The practitioner's leaves that end after `from` (default now), by start. */
	async upcomingLeaves(
		tx: ClinicalTx,
		practitionerId: string,
		from: Date = new Date(),
	): Promise<PractitionerLeave[]> {
		return (await this.schedules.listLeavesFrom(tx, [practitionerId], from)).map(toPractitionerLeave);
	}

	/** The clinic's active weekly sessions (every practitioner, or one), by day and start time. */
	async weeklySchedule(tx: ClinicalTx, clinicId: string, practitionerId?: string): Promise<WeeklySession[]> {
		return (await this.schedules.listSchedules(tx, { clinicId, practitionerId })).map(toWeeklySession);
	}
}

/** `09:00` from a `time` column (Prisma reads it as 1970-01-01T09:00:00Z). */
export function timeOfDay(value: Date): string {
	return value.toISOString().slice(11, 16);
}

/** A `time` column value from `HH:MM`. */
export function timeColumn(value: string): Date {
	return new Date(`1970-01-01T${value}:00Z`);
}

export function toWeeklySession(row: PractitionerSchedule): WeeklySession {
	return {
		id: row.id,
		dayOfWeek: row.dayOfWeek,
		startTime: timeOfDay(row.startTime),
		endTime: timeOfDay(row.endTime),
		slotMinutes: row.slotMinutes,
		maxPatients: row.maxPatients,
	};
}
