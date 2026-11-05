import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { CurrentUser } from '../../../common/decorators/current.decorator.js';
import { AppointmentService } from './appointment.service.js';
import { AppointmentSlotService } from './appointment-slot.service.js';
import {
	AppointmentSlotsInput,
	BookAppointmentInput,
	CancelAppointmentInput,
	ClinicAppointmentsInput,
	RescheduleAppointmentInput,
} from './dto/appointment.input.js';
import { Appointment, AppointmentSlot } from './models/appointment.model.js';

/**
 * Appointments at one of your clinics. Booking, rescheduling, cancelling, confirming and no-shows: the front desk and
 * clinic admins. Reading: staff of the clinic (row-level security picks the patients).
 */
@Resolver(() => Appointment)
export class AppointmentsResolver {
	constructor(
		private readonly appointments: AppointmentService,
		private readonly slots: AppointmentSlotService,
	) {}

	@Query(() => [Appointment], { description: "A clinic's appointments over 1–7 days, by time." })
	clinicAppointments(
		@CurrentUser() user: AuthUser,
		@Args('input') input: ClinicAppointmentsInput,
	): Promise<Appointment[]> {
		return this.appointments.list(user.id, input);
	}

	@Query(() => [AppointmentSlot], { description: "A doctor's slots on a day: schedule minus leaves and bookings." })
	appointmentSlots(
		@CurrentUser() user: AuthUser,
		@Args('input') input: AppointmentSlotsInput,
	): Promise<AppointmentSlot[]> {
		return this.slots.list(user.id, input);
	}

	@Mutation(() => Appointment, { description: "Books a patient into one of a doctor's open slots." })
	bookAppointment(@CurrentUser() user: AuthUser, @Args('input') input: BookAppointmentInput): Promise<Appointment> {
		return this.appointments.book(user.id, input);
	}

	@Mutation(() => Appointment, { description: 'Moves a booking to another slot; returns the new appointment.' })
	rescheduleAppointment(
		@CurrentUser() user: AuthUser,
		@Args('input') input: RescheduleAppointmentInput,
	): Promise<Appointment> {
		return this.appointments.reschedule(user.id, input);
	}

	@Mutation(() => Appointment, { description: 'Cancels an upcoming booking, with the reason.' })
	cancelAppointment(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CancelAppointmentInput,
	): Promise<Appointment> {
		return this.appointments.cancel(user.id, input);
	}

	@Mutation(() => Appointment, { description: 'The patient confirmed the booking.' })
	confirmAppointment(
		@CurrentUser() user: AuthUser,
		@Args('appointmentId', { type: () => ID }) appointmentId: string,
	): Promise<Appointment> {
		return this.appointments.confirm(user.id, appointmentId);
	}

	@Mutation(() => Appointment, { description: "The patient didn't come (after the booked time)." })
	markAppointmentNoShow(
		@CurrentUser() user: AuthUser,
		@Args('appointmentId', { type: () => ID }) appointmentId: string,
	): Promise<Appointment> {
		return this.appointments.markNoShow(user.id, appointmentId);
	}
}
