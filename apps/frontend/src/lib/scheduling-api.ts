import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	AppointmentDocument,
	AppointmentSlotsDocument,
	BookAppointmentDocument,
	CallNextQueueTicketDocument,
	CallQueueTicketDocument,
	CancelAppointmentDocument,
	CancelQueueTicketDocument,
	CheckInPatientDocument,
	ClinicAppointmentsDocument,
	CompleteQueueTicketDocument,
	ConfirmAppointmentDocument,
	MarkAppointmentNoShowDocument,
	QueueBoardDocument,
	QueueTicketsDocument,
	RequeueQueueTicketDocument,
	RescheduleAppointmentDocument,
	SchedulingPractitionersDocument,
	SendQueueTicketDocument,
	SkipQueueTicketDocument,
	StartQueueTicketDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['scheduling'];
type Outputs = ApiOutputs['scheduling'];

/**
 * Appointments and the queue (`apps/api/src/clinical/scheduling`). Every read is under `['scheduling', …]`, so a
 * booking, a check-in or a queue move refreshes the calendar, the lines and the board with one invalidation
 * (`schedulingApi.invalidate`).
 */
export const schedulingApi = {
	practitioners: query<Inputs['practitioners'], Outputs['practitioners']>(
		['scheduling', 'practitioners'],
		async ({ clinicId }) => (await runQuery(SchedulingPractitionersDocument, { clinicId })).clinicPractitioners,
	),
	appointments: query<Inputs['appointments'], Outputs['appointments']>(
		['scheduling', 'appointments'],
		async (input) => (await runQuery(ClinicAppointmentsDocument, { input })).clinicAppointments,
	),
	appointment: query<Inputs['appointment'], Outputs['appointment']>(
		['scheduling', 'appointment'],
		async ({ appointmentId }) => (await runQuery(AppointmentDocument, { appointmentId })).appointment,
	),
	slots: query<Inputs['slots'], Outputs['slots']>(
		['scheduling', 'slots'],
		async (input) => (await runQuery(AppointmentSlotsDocument, { input })).appointmentSlots,
	),
	tickets: query<Inputs['tickets'], Outputs['tickets']>(
		['scheduling', 'tickets'],
		async (input) => (await runQuery(QueueTicketsDocument, { input })).queueTickets,
	),
	board: query<Inputs['board'], Outputs['board']>(
		['scheduling', 'board'],
		async ({ clinicId }) => (await runQuery(QueueBoardDocument, { clinicId })).queueBoard,
	),
	book: mutation<Inputs['book'], Outputs['book']>(
		['scheduling', 'book'],
		async (input) => (await runMutation(BookAppointmentDocument, { input })).bookAppointment,
	),
	reschedule: mutation<Inputs['reschedule'], Outputs['reschedule']>(
		['scheduling', 'reschedule'],
		async (input) => (await runMutation(RescheduleAppointmentDocument, { input })).rescheduleAppointment,
	),
	cancel: mutation<Inputs['cancel'], Outputs['cancel']>(
		['scheduling', 'cancel'],
		async (input) => (await runMutation(CancelAppointmentDocument, { input })).cancelAppointment,
	),
	confirm: mutation<Inputs['confirm'], Outputs['confirm']>(
		['scheduling', 'confirm'],
		async ({ appointmentId }) =>
			(await runMutation(ConfirmAppointmentDocument, { appointmentId })).confirmAppointment,
	),
	noShow: mutation<Inputs['noShow'], Outputs['noShow']>(
		['scheduling', 'noShow'],
		async ({ appointmentId }) =>
			(await runMutation(MarkAppointmentNoShowDocument, { appointmentId })).markAppointmentNoShow,
	),
	checkIn: mutation<Inputs['checkIn'], Outputs['checkIn']>(
		['scheduling', 'checkIn'],
		async (input) => (await runMutation(CheckInPatientDocument, { input })).checkInPatient,
	),
	callNext: mutation<Inputs['callNext'], Outputs['callNext']>(
		['scheduling', 'callNext'],
		async (input) => (await runMutation(CallNextQueueTicketDocument, { input })).callNextQueueTicket ?? null,
	),
	call: mutation<Inputs['call'], Outputs['call']>(
		['scheduling', 'call'],
		async ({ ticketId }) => (await runMutation(CallQueueTicketDocument, { ticketId })).callQueueTicket,
	),
	start: mutation<Inputs['start'], Outputs['start']>(
		['scheduling', 'start'],
		async ({ ticketId }) => (await runMutation(StartQueueTicketDocument, { ticketId })).startQueueTicket,
	),
	send: mutation<Inputs['send'], Outputs['send']>(
		['scheduling', 'send'],
		async (input) => (await runMutation(SendQueueTicketDocument, { input })).sendQueueTicket,
	),
	complete: mutation<Inputs['complete'], Outputs['complete']>(
		['scheduling', 'complete'],
		async ({ ticketId }) => (await runMutation(CompleteQueueTicketDocument, { ticketId })).completeQueueTicket,
	),
	skip: mutation<Inputs['skip'], Outputs['skip']>(
		['scheduling', 'skip'],
		async ({ ticketId }) => (await runMutation(SkipQueueTicketDocument, { ticketId })).skipQueueTicket,
	),
	requeue: mutation<Inputs['requeue'], Outputs['requeue']>(
		['scheduling', 'requeue'],
		async ({ ticketId }) => (await runMutation(RequeueQueueTicketDocument, { ticketId })).requeueQueueTicket,
	),
	cancelTicket: mutation<Inputs['cancelTicket'], Outputs['cancelTicket']>(
		['scheduling', 'cancelTicket'],
		async (input) => (await runMutation(CancelQueueTicketDocument, { input })).cancelQueueTicket,
	),
	/** Refreshes every scheduling read (calendar, slots, lines, board). */
	invalidate: { queryKey: [['scheduling']] as const },
};
