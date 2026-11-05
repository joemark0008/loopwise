import type { ClinicalTone } from '@/components/clinical/clinical-flag';
import type {
	AppointmentStatus,
	BookingChannel,
	PriorityReason,
	QueueStatus,
	VisitType,
} from '@/graphql/generated/graphql';

/**
 * Words and Manila clock times for the front desk, triage, the doctor's line and the board. Clinic hours are Asia/Manila
 * whatever the browser's time zone, so times are formatted there.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `YYYY-MM-DD` in Manila. */
export const manilaDate = (at: Date = new Date()) =>
	new Date(at.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);

/** `HH:MM` in Manila. */
export const manilaTime = (value: string | Date) =>
	new Date(new Date(value).getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);

export const addDays = (date: string, days: number) =>
	new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/** `Mon 9 Nov`. */
export function dayLabel(date: string): string {
	const day = new Date(`${date}T00:00:00Z`);
	return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
}

/** Minutes since `since`, as "4 min" / "1 h 05 min". */
export function waited(since: string, now: Date = new Date()): string {
	const minutes = Math.max(0, Math.round((now.getTime() - new Date(since).getTime()) / 60_000));
	return minutes < 60
		? `${minutes} min`
		: `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
	NEW_PATIENT: 'New patient',
	FOLLOW_UP: 'Follow-up',
	PROCEDURE: 'Procedure',
	TELECONSULT: 'Teleconsult',
	PEME: 'Pre-employment exam',
	APE: 'Annual physical exam',
};

export const CHANNEL_LABELS: Record<BookingChannel, string> = {
	WALK_IN: 'Walk-in',
	PHONE: 'Phone',
	SMS: 'SMS',
	FACEBOOK_MESSENGER: 'Messenger',
	VIBER: 'Viber',
	ONLINE_PORTAL: 'Portal',
	REFERRAL: 'Referral',
};

export const PRIORITY_REASON_LABELS: Record<PriorityReason, string> = {
	SENIOR_CITIZEN: 'Senior citizen',
	PWD: 'PWD',
	PREGNANT: 'Pregnant',
	WITH_INFANT: 'With an infant',
	EMERGENCY: 'Emergency',
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, { label: string; tone: ClinicalTone }> = {
	SCHEDULED: { label: 'Booked', tone: 'info' },
	CONFIRMED: { label: 'Confirmed', tone: 'info' },
	ARRIVED: { label: 'Checked in', tone: 'normal' },
	IN_PROGRESS: { label: 'With the doctor', tone: 'normal' },
	COMPLETED: { label: 'Seen', tone: 'done' },
	CANCELLED: { label: 'Cancelled', tone: 'void' },
	NO_SHOW: { label: 'No-show', tone: 'abnormal' },
	RESCHEDULED: { label: 'Rescheduled', tone: 'void' },
};

export const QUEUE_STATUS: Record<QueueStatus, { label: string; tone: ClinicalTone }> = {
	WAITING: { label: 'Waiting', tone: 'info' },
	CALLED: { label: 'Called', tone: 'abnormal' },
	SERVING: { label: 'Being seen', tone: 'normal' },
	DONE: { label: 'Done', tone: 'done' },
	SKIPPED: { label: 'Not here', tone: 'void' },
	CANCELLED: { label: 'Cancelled', tone: 'void' },
};

/** Bookings the front desk can still change. */
export const isUpcoming = (status: AppointmentStatus) => status === 'SCHEDULED' || status === 'CONFIRMED';
