import { Injectable, Logger } from '@nestjs/common';

/**
 * An appointment reminder to send: an invitation only (clinic, day and time), never a reason, a result or a
 * diagnosis (DESIGN.md §3). No patient name either: the number it goes to is the patient's.
 */
export interface AppointmentReminder {
	appointmentId: string;
	to: string;
	language: string | null;
	clinicName: string;
	/** YYYY-MM-DD and HH:MM, Manila. */
	date: string;
	time: string;
}

/** Sends appointment reminders (SMS later, PLAN.md §4.6). Returns whether the message was accepted. */
export interface AppointmentNotifier {
	sendReminder(reminder: AppointmentReminder): Promise<boolean>;
}

export const APPOINTMENT_NOTIFIER = Symbol('APPOINTMENT_NOTIFIER');

/** The stub until an SMS gateway is chosen: logs that a reminder would go out (no number, no content) and accepts it. */
@Injectable()
export class LogAppointmentNotifier implements AppointmentNotifier {
	private readonly logger = new Logger(LogAppointmentNotifier.name);

	sendReminder(reminder: AppointmentReminder): Promise<boolean> {
		this.logger.log(`Reminder for appointment ${reminder.appointmentId} (stub, nothing sent)`);
		return Promise.resolve(true);
	}
}

/** The reminder text, in the patient's language: when and where, nothing clinical. */
export function reminderText(reminder: AppointmentReminder): string {
	const when = `${reminder.date} ${reminder.time}`;
	switch (reminder.language) {
		case 'fil':
			return `Paalala: may appointment kayo sa ${reminder.clinicName} sa ${when}.`;
		case 'ceb':
			return `Pahinumdom: aduna kay appointment sa ${reminder.clinicName} sa ${when}.`;
		default:
			return `Reminder: you have an appointment at ${reminder.clinicName} on ${when}.`;
	}
}
