import type { ClinicalTone } from '@/components/clinical/clinical-flag';
import type { DiagnosticOrderStatus, OrderPriority } from '@/graphql/generated/graphql';

const PRIORITY_RANK: Record<OrderPriority, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 };

export const PRIORITY_LABELS: Record<OrderPriority, string> = { STAT: 'STAT', URGENT: 'Urgent', ROUTINE: 'Routine' };

/** Worklist order: STAT first, then urgent, then routine; the oldest order first within each. */
export function byPriorityThenAge<T extends { order: { priority: OrderPriority; createdAt: string } }>(
	items: readonly T[],
): T[] {
	const time = (item: T) => new Date(item.order.createdAt).getTime();
	return [...items].sort(
		(a, b) => PRIORITY_RANK[a.order.priority] - PRIORITY_RANK[b.order.priority] || time(a) - time(b),
	);
}

/** How long a test has waited: `12 min`, `3 h`, `2 d`. */
export function waitingFor(since: string, now = new Date()): string {
	const minutes = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
	if (minutes < 60) {
		return `${minutes} min`;
	}
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}

/** A test's status in words and tone (`DiagnosticOrderStatus`). */
export const DIAGNOSTIC_STATUS: Record<DiagnosticOrderStatus, { label: string; tone: ClinicalTone }> = {
	REQUESTED: { label: 'Requested', tone: 'info' },
	PAID: { label: 'Paid', tone: 'info' },
	SPECIMEN_COLLECTED: { label: 'Collected', tone: 'info' },
	IN_PROGRESS: { label: 'In progress', tone: 'info' },
	RESULTED: { label: 'Resulted', tone: 'abnormal' },
	RELEASED: { label: 'Released', tone: 'done' },
	CANCELLED: { label: 'Cancelled', tone: 'void' },
};

/** The worklist steps a test can still be cancelled at (before its result). */
export const CANCELLABLE: readonly DiagnosticOrderStatus[] = ['REQUESTED', 'PAID', 'SPECIMEN_COLLECTED', 'IN_PROGRESS'];

/** `Maria Santos`. */
export const personName = (patient: { firstName: string; lastName: string }) =>
	`${patient.firstName} ${patient.lastName}`;

/** `45 F`: age in whole years on `today` and sex, as the lab desk and the inbox show it. */
export function ageSex(birthDate: string, sex: 'MALE' | 'FEMALE', today = new Date()): string {
	const [year, month, day] = birthDate.split('-').map(Number);
	const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
	return `${today.getFullYear() - year - (hadBirthday ? 0 : 1)} ${sex === 'MALE' ? 'M' : 'F'}`;
}

/** The reference range a parameter prints for a sex: `4–5.6`, `< 200`, `≥ 40`, else its text range. */
export function parameterRange(
	parameter: {
		refLowMale?: number | null;
		refHighMale?: number | null;
		refLowFemale?: number | null;
		refHighFemale?: number | null;
		refRangeText?: string | null;
	},
	sex: 'MALE' | 'FEMALE',
): string | null {
	const low = sex === 'MALE' ? parameter.refLowMale : parameter.refLowFemale;
	const high = sex === 'MALE' ? parameter.refHighMale : parameter.refHighFemale;
	if (low != null && high != null) {
		return `${low}–${high}`;
	}
	if (high != null) {
		return `< ${high}`;
	}
	if (low != null) {
		return `≥ ${low}`;
	}
	return parameter.refRangeText ?? null;
}
