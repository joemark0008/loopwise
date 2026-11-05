import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { text } from '../../../common/input-values.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import type { ClinicActor } from '../../clinics/clinic-admin-actor.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { InvalidScheduleError, ScheduleOverlapError } from '../practitioners.errors.js';
import type { AddPractitionerLeaveInput, PractitionerScheduleInput } from '../setup/dto/practitioner-setup.input.js';
import type { PractitionerScheduleEntry } from '../setup/models/clinic-practitioner.model.js';
import { toScheduleEntry } from '../setup/practitioner-setup.service.js';
import { isDateOnly, manilaDayRange, manilaInstant, minutesOf, timesOverlap } from './availability.js';
import { type PractitionerLeave, toPractitionerLeave } from './models/practitioner-availability.model.js';
import { PractitionerScheduleRepository } from './practitioner-schedule.repository.js';
import { timeColumn, toWeeklySession } from './practitioner-schedule.service.js';

const MAX_LEAVE_DAYS = 366;

/**
 * Clinic admins keep the practitioners' weekly clinic hours and leaves (Settings → Clinic → Practitioners). Sessions
 * are written as the user (the clinic's staff own `practitioner_schedules`); a practitioner is in one place at a time,
 * so the overlap check reads their sessions at every clinic as system work. Users may only add their own leaves and
 * delete nothing, so leaves and removals are system work, kept to practitioners linked to the admin's clinic. Every
 * change writes its audit row.
 */
@Injectable()
export class PractitionerScheduleAdminService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly schedules: PractitionerScheduleRepository,
		private readonly audit: AuditService,
	) {}

	/** Adds a weekly session at the clinic, or changes one (`input.id`). */
	async saveSchedule(actor: ClinicActor, input: PractitionerScheduleInput): Promise<PractitionerScheduleEntry> {
		const length = minutesOf(input.endTime) - minutesOf(input.startTime);
		if (length <= 0) {
			throw new InvalidScheduleError('A session ends after it starts.');
		}
		if (input.slotMinutes > length) {
			throw new InvalidScheduleError('A slot fits inside the session.');
		}
		const others = await this.db.asSystem((tx) =>
			this.schedules.listSessionsOnDay(tx, input.practitionerId, input.dayOfWeek),
		);
		const clash = others
			.filter((row) => row.id !== input.id)
			.map(toWeeklySession)
			.find((session) => timesOverlap(session, input));
		if (clash) {
			throw new ScheduleOverlapError(input.dayOfWeek, clash.startTime, clash.endTime);
		}
		return this.db.asUser(actor.userId, async (tx) => {
			await this.requireLinked(tx, input.practitionerId, actor.clinicId);
			const before = input.id ? await this.schedules.findSchedule(tx, input.id) : null;
			if (
				input.id &&
				(!before || before.clinicId !== actor.clinicId || before.practitionerId !== input.practitionerId)
			) {
				throw new EntityNotFoundError('PractitionerSchedule', input.id);
			}
			const data = {
				dayOfWeek: input.dayOfWeek,
				startTime: timeColumn(input.startTime),
				endTime: timeColumn(input.endTime),
				slotMinutes: input.slotMinutes,
				maxPatients: input.maxPatients ?? null,
				isActive: true,
			};
			const row = before
				? await this.schedules.updateSchedule(tx, before.id, data)
				: await this.schedules.createSchedule(tx, {
						...data,
						practitionerId: input.practitionerId,
						clinicId: actor.clinicId,
					});
			await this.audit.record(tx, {
				action: before ? 'UPDATE' : 'CREATE',
				event: before ? 'practitioner_schedule.update' : 'practitioner_schedule.create',
				entityType: 'PractitionerSchedule',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: before
					? auditChanges({ ...toWeeklySession(before) }, { ...toWeeklySession(row) })
					: { after: auditSnapshot({ ...toWeeklySession(row), practitionerId: row.practitionerId }) },
			});
			return toScheduleEntry(row.practitionerId, row);
		});
	}

	/** Removes a weekly session of the clinic. */
	removeSchedule(actor: ClinicActor, scheduleId: string): Promise<boolean> {
		return this.db.asSystem(async (tx) => {
			const row = await this.schedules.findSchedule(tx, scheduleId);
			if (!row || row.clinicId !== actor.clinicId) {
				throw new EntityNotFoundError('PractitionerSchedule', scheduleId);
			}
			await this.schedules.deleteSchedule(tx, row.id);
			await this.audit.record(tx, {
				action: 'DELETE',
				event: 'practitioner_schedule.delete',
				entityType: 'PractitionerSchedule',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: { before: auditSnapshot({ ...toWeeklySession(row), practitionerId: row.practitionerId }) },
			});
			return true;
		});
	}

	/**
	 * Adds a leave from `startDate` to `endDate` (inclusive, Philippine dates): whole days, or from `startTime` on the
	 * first day and until `endTime` on the last.
	 */
	addLeave(actor: ClinicActor, input: AddPractitionerLeaveInput): Promise<PractitionerLeave> {
		if (!isDateOnly(input.startDate) || !isDateOnly(input.endDate)) {
			throw new InvalidScheduleError('Leave dates are YYYY-MM-DD.');
		}
		const startAt = manilaInstant(input.startDate, input.startTime ?? '00:00');
		const endAt = input.endTime ? manilaInstant(input.endDate, input.endTime) : manilaDayRange(input.endDate).to;
		if (endAt.getTime() <= startAt.getTime()) {
			throw new InvalidScheduleError('A leave ends after it starts.');
		}
		if (endAt.getTime() - startAt.getTime() > MAX_LEAVE_DAYS * 24 * 60 * 60 * 1000) {
			throw new InvalidScheduleError(`A leave is at most ${MAX_LEAVE_DAYS} days; add another for longer.`);
		}
		return this.db.asSystem(async (tx) => {
			await this.requireLinked(tx, input.practitionerId, actor.clinicId);
			const row = await this.schedules.createLeave(tx, {
				practitionerId: input.practitionerId,
				startAt,
				endAt,
				reason: text(input.reason),
			});
			await this.audit.created(tx, {
				event: 'practitioner_leave.create',
				entityType: 'PractitionerLeave',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: { after: auditSnapshot(row) },
			});
			return toPractitionerLeave(row);
		});
	}

	/** Removes a leave of a practitioner who holds clinic here. */
	removeLeave(actor: ClinicActor, leaveId: string): Promise<boolean> {
		return this.db.asSystem(async (tx) => {
			const row = await this.schedules.findLeave(tx, leaveId);
			if (!row || !(await this.schedules.findClinicLink(tx, row.practitionerId, actor.clinicId))) {
				throw new EntityNotFoundError('PractitionerLeave', leaveId);
			}
			await this.schedules.deleteLeave(tx, row.id);
			await this.audit.record(tx, {
				action: 'DELETE',
				event: 'practitioner_leave.delete',
				entityType: 'PractitionerLeave',
				entityId: row.id,
				userId: actor.userId,
				organizationId: actor.organizationId,
				clinicId: actor.clinicId,
				changes: { before: auditSnapshot(row) },
			});
			return true;
		});
	}

	private async requireLinked(tx: ClinicalTx, practitionerId: string, clinicId: string): Promise<void> {
		if (!(await this.schedules.findClinicLink(tx, practitionerId, clinicId))) {
			throw new EntityNotFoundError('Practitioner', practitionerId);
		}
	}
}
