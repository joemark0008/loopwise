import { Inject, Injectable } from '@nestjs/common';

import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { PRACTITIONER_AVAILABILITY, type PractitionerAvailability } from '../availability/practitioner-availability.js';
import { manilaDate, manilaRange } from '../manila-time.js';
import { SlotStatus } from '../scheduling.enums.js';
import { PractitionerNotAtClinicError, SlotNotInScheduleError, SlotUnavailableError } from '../scheduling.errors.js';
import { SchedulingAccess } from '../scheduling-access.js';
import { AppointmentRepository, type PractitionerAtClinic } from './appointment.repository.js';
import type { AppointmentSlot } from './models/appointment.model.js';
import { buildSlots, type SlotDraft } from './slots.js';

/**
 * A doctor's bookable slots: their sessions at the clinic that day (`PractitionerAvailability`), minus leaves and
 * existing bookings, within the session's `max_patients`. Bookings are counted as system work, so a desk that can't
 * see every patient still never double-books.
 */
@Injectable()
export class AppointmentSlotService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly appointments: AppointmentRepository,
		private readonly access: SchedulingAccess,
		@Inject(PRACTITIONER_AVAILABILITY) private readonly availability: PractitionerAvailability,
	) {}

	/** The doctor's slots on a day, for staff of the clinic. */
	async list(
		userId: string,
		query: { clinicId: string; practitionerId: string; date: string },
	): Promise<AppointmentSlot[]> {
		await this.access.atClinic(userId, query.clinicId);
		return this.db.asSystem(async (tx) => {
			await this.requirePractitioner(tx, query.practitionerId, query.clinicId);
			return this.slotsOn(tx, query);
		});
	}

	/** The doctor at the clinic, else PRACTITIONER_NOT_AT_CLINIC. */
	async requirePractitioner(tx: ClinicalTx, practitionerId: string, clinicId: string): Promise<PractitionerAtClinic> {
		const practitioner = await this.appointments.practitionerAtClinic(tx, practitionerId, clinicId);
		if (!practitioner) {
			throw new PractitionerNotAtClinicError();
		}
		return practitioner;
	}

	/**
	 * The open slot starting at `start`, on the caller's system transaction, after locking the doctor's day: refused
	 * when it isn't a slot (SLOT_NOT_IN_SCHEDULE) or can't be booked (SLOT_UNAVAILABLE, with the reason).
	 */
	async requireBookable(
		tx: ClinicalTx,
		query: { clinicId: string; practitionerId: string; start: Date },
	): Promise<SlotDraft> {
		const date = manilaDate(query.start);
		await this.appointments.lockPractitionerDay(tx, query.practitionerId, date);
		const slot = (await this.slotsOn(tx, { ...query, date })).find(
			(candidate) => candidate.start.getTime() === query.start.getTime(),
		);
		if (!slot) {
			throw new SlotNotInScheduleError();
		}
		if (slot.status !== SlotStatus.OPEN) {
			throw new SlotUnavailableError(slot.status);
		}
		return slot;
	}

	private async slotsOn(
		tx: ClinicalTx,
		query: { clinicId: string; practitionerId: string; date: string },
	): Promise<SlotDraft[]> {
		const sessions = await this.availability.availabilityFor(tx, query);
		const { start, end } = manilaRange(query.date);
		const bookings = await this.appointments.activeBookings(tx, query.practitionerId, start, end);
		const slots = buildSlots(sessions, bookings);
		for (const slot of slots) {
			if (
				slot.status === SlotStatus.OPEN &&
				(await this.availability.isOnLeave(tx, query.practitionerId, slot.start, slot.end))
			) {
				slot.status = SlotStatus.ON_LEAVE;
			}
		}
		return slots;
	}
}
