import { Inject, Injectable, Logger } from '@nestjs/common';

import { Job } from '../../../jobs/job.decorator.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { addDays, manilaClock, manilaDate, manilaRange } from '../manila-time.js';
import { APPOINTMENT_NOTIFIER, type AppointmentNotifier } from './appointment-notifier.js';

export const APPOINTMENT_REMINDERS_JOB = 'scheduling.appointment-reminders';

/** How many reminders one run sends at most (the next run picks up the rest). */
const BATCH = 500;

/**
 * Next-day appointment reminders (PLAN.md §4.2): a pg-boss job, every day at 09:00 and 17:00 Manila, that finds
 * tomorrow's bookings not reminded yet at every clinic, sends each through the `AppointmentNotifier` (a stub until
 * there is an SMS gateway) and marks `reminder_sent_at`. System work: one audit row per reminder, `origin` the job.
 * A patient without a mobile number is skipped and stays unmarked.
 */
@Injectable()
export class AppointmentReminderService {
	private readonly logger = new Logger(AppointmentReminderService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly appointments: AppointmentRepository,
		private readonly audit: AuditService,
		@Inject(APPOINTMENT_NOTIFIER) private readonly notifier: AppointmentNotifier,
	) {}

	@Job(APPOINTMENT_REMINDERS_JOB, { cron: '0 9,17 * * *', tz: 'Asia/Manila', retryLimit: 2 })
	async handle(): Promise<void> {
		const sent = await this.sendDue();
		this.logger.log(`Appointment reminders sent: ${sent}`);
	}

	/** Sends tomorrow's reminders (Manila), as of `now`. Returns how many were sent. */
	async sendDue(now: Date = new Date()): Promise<number> {
		const tomorrow = addDays(manilaDate(now), 1);
		const { start, end } = manilaRange(tomorrow);
		const due = await this.db.asSystem((tx) => this.appointments.dueForReminder(tx, start, end, BATCH));
		let sent = 0;
		for (const appointment of due) {
			if (!appointment.patient.mobileNo) {
				continue;
			}
			const accepted = await this.notifier.sendReminder({
				appointmentId: appointment.id,
				to: appointment.patient.mobileNo,
				language: appointment.patient.preferredLanguage,
				clinicName: appointment.clinic.name,
				date: tomorrow,
				time: manilaClock(appointment.scheduledStart),
			});
			if (!accepted) {
				continue;
			}
			const marked = await this.db.asSystem(async (tx) => {
				const at = new Date();
				if (!(await this.appointments.markReminded(tx, appointment.id, at))) {
					return false;
				}
				await this.audit.updated(tx, {
					event: 'appointment.remind',
					entityType: 'Appointment',
					entityId: appointment.id,
					userId: null,
					patientId: appointment.patientId,
					organizationId: appointment.clinic.organizationId,
					clinicId: appointment.clinicId,
					changes: { before: { reminderSentAt: null }, after: { reminderSentAt: at.toISOString() } },
					origin: { via: 'job', name: APPOINTMENT_REMINDERS_JOB },
				});
				return true;
			});
			sent += marked ? 1 : 0;
		}
		return sent;
	}
}
