import type { listAppointments, listQueue } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { InvalidInputError } from '../patients/patients.errors.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import { AppointmentRepository, type PractitionerAtClinic } from './appointments/appointment.repository.js';
import { personName, toSchedulingPractitioner } from './appointments/models/appointment.model.js';
import { isCalendarDate, manilaClock, manilaDate, manilaRange } from './manila-time.js';
import { QueueService } from './queue/queue.service.js';
import { SchedulingAccess } from './scheduling-access.js';

/**
 * The read methods Wise's scheduling tools call (`list_appointments`, `list_queue`), as the user at the chat's clinic:
 * row-level security picks the patients, and each read writes its audit row. Booking and moving appointments are the
 * user's own mutations, from the cards; queue moves are never made from chat.
 */
@Injectable()
export class SchedulingWiseReader {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly appointments: AppointmentRepository,
		private readonly queue: QueueService,
		private readonly access: SchedulingAccess,
		private readonly audit: AuditService,
	) {}

	async appointmentsForWise(
		userId: string,
		clinicId: string | null,
		input: listAppointments.Input & { patientId?: string | null; limit: number },
	): Promise<Omit<listAppointments.Output, '_version'>> {
		const actor = await this.access.atClinic(userId, requireClinic(clinicId));
		const date = input.date?.trim() || manilaDate();
		if (!isCalendarDate(date)) {
			throw new InvalidInputError(`"${date}" isn't a date: use YYYY-MM-DD.`);
		}
		const { start, end } = manilaRange(date);
		const patientId = input.wholeDay ? null : (input.patientId ?? null);
		return this.db.asUser(userId, async (tx) => {
			const doctor = input.doctor?.trim()
				? matchDoctor(await this.appointments.practitionersAtClinic(tx, actor.clinic.id), input.doctor)
				: null;
			const rows = await this.appointments.listInRange(tx, {
				clinicId: actor.clinic.id,
				from: start,
				to: end,
				practitionerId: doctor?.id,
				patientId,
			});
			await this.audit.view(tx, {
				event: 'appointment.list',
				entityType: 'Appointment',
				userId,
				patientId,
				organizationId: actor.clinic.organizationId,
				clinicId: actor.clinic.id,
				reason: 'Wise list_appointments',
			});
			return {
				date,
				clinicName: actor.clinic.name,
				doctor: doctor && toSchedulingPractitioner(doctor, actor.clinic.id).name,
				appointments: rows.slice(0, input.limit).map((row) => ({
					id: row.id,
					time: manilaClock(row.scheduledStart),
					scheduledStart: row.scheduledStart.toISOString(),
					status: row.status,
					visitType: row.visitType,
					channel: row.channel,
					reason: row.reason,
					checkedIn: row.encounter !== null,
					patient: { id: row.patient.id, name: personName(row.patient), patientNo: row.patient.patientNo },
					doctor: {
						id: row.practitionerId,
						name: toSchedulingPractitioner(row.practitioner, row.clinicId).name,
					},
				})),
				truncated: rows.length > input.limit,
			};
		});
	}

	async queueForWise(
		userId: string,
		clinicId: string | null,
		input: listQueue.Input,
	): Promise<Omit<listQueue.Output, '_version'>> {
		const actor = await this.access.atClinic(userId, requireClinic(clinicId));
		const tickets = await this.queue.list(userId, {
			clinicId: actor.clinic.id,
			station: input.mine ? null : (input.station ?? null),
			mine: input.mine ?? false,
			statuses: input.includeDone ? null : ['WAITING', 'CALLED', 'SERVING', 'SKIPPED'],
		});
		await this.db.asUser(userId, (tx) =>
			this.audit.view(tx, {
				event: 'queue.list',
				entityType: 'QueueTicket',
				userId,
				organizationId: actor.clinic.organizationId,
				clinicId: actor.clinic.id,
				reason: 'Wise list_queue',
			}),
		);
		const waiting = tickets.filter((ticket) => ticket.status === 'WAITING');
		return {
			date: manilaDate(),
			clinicName: actor.clinic.name,
			next: waiting[0]?.code ?? null,
			waiting: waiting.length,
			tickets: tickets.map((ticket) => ({
				code: ticket.code,
				status: ticket.status,
				station: ticket.station,
				stationLabel: ticket.stationLabel,
				isPriority: ticket.isPriority,
				priorityReason: ticket.priorityReason,
				issuedAt: ticket.issuedAt.toISOString(),
				patient: ticket.patient && { id: ticket.patient.id, name: ticket.patient.name },
				reason: ticket.encounter?.reason ?? null,
				doctor: ticket.practitioner?.name ?? null,
			})),
		};
	}
}

function requireClinic(clinicId: string | null): string {
	if (!clinicId) {
		throw new InvalidInputError('This chat has no clinic. Open Wise from one of your clinics.');
	}
	return clinicId;
}

/** The one doctor of the clinic whose name has every word given; else the list to ask from. */
function matchDoctor(doctors: PractitionerAtClinic[], words: string): PractitionerAtClinic {
	const wanted = words
		.toLowerCase()
		.replace(/\b(dra?|doctor|doc)\.?\s+/g, '')
		.split(/\s+/)
		.filter(Boolean);
	const matches = doctors.filter((doctor) => {
		const name = `${doctor.firstName} ${doctor.middleName ?? ''} ${doctor.lastName}`.toLowerCase();
		return wanted.every((word) => name.includes(word));
	});
	if (matches.length !== 1) {
		const names = doctors.map((doctor) => `${doctor.firstName} ${doctor.lastName}`).join(', ');
		throw new InvalidInputError(
			`${matches.length === 0 ? 'No' : 'More than one'} doctor at this clinic matches "${words}". ` +
				`The clinic's doctors are: ${names || 'none'}. Ask the user which one.`,
		);
	}
	return matches[0];
}
