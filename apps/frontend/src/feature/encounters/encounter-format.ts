import { WORK_FITNESS_LABELS } from '@quarry/shared/medical-certificate';
import type {
	PrescriptionItemFieldsFragment,
	VitalSignsFieldsFragment,
	WorkFitness,
} from '@/graphql/generated/graphql';

/**
 * Clinical dates read one way everywhere: `22 Oct 2026`, times on a 24-hour clock. Day and month names never swap
 * between locales the way 10/4 does.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const day = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
const pad = (value: number) => String(value).padStart(2, '0');

export const formatDate = (value: string) => day(new Date(value));

export const formatDateTime = (value: string) => {
	const date = new Date(value);
	return `${day(date)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** `2026-11-20` → `20 Nov 2026`, without shifting the day through a time zone. */
export const formatDay = (value: string) => day(new Date(`${value}T00:00:00`));

export const fitnessLabel = (fitness: WorkFitness) => WORK_FITNESS_LABELS[fitness];

/** The chips of a set of vitals, e.g. `BP 140/90`, `HR 88`, `BMI 30.0`. */
export function vitalChips(vitals: VitalSignsFieldsFragment): string[] {
	const chips: string[] = [];
	if (vitals.systolicMmHg !== null && vitals.diastolicMmHg !== null) {
		chips.push(`BP ${vitals.systolicMmHg}/${vitals.diastolicMmHg}`);
	}
	if (vitals.heartRateBpm !== null) {
		chips.push(`HR ${vitals.heartRateBpm}`);
	}
	if (vitals.respiratoryRate !== null) {
		chips.push(`RR ${vitals.respiratoryRate}`);
	}
	if (vitals.temperatureC !== null) {
		chips.push(`T ${vitals.temperatureC.toFixed(1)} °C`);
	}
	if (vitals.spo2Pct !== null) {
		chips.push(`SpO₂ ${vitals.spo2Pct}%`);
	}
	if (vitals.weightKg !== null) {
		chips.push(`Wt ${vitals.weightKg} kg`);
	}
	if (vitals.heightCm !== null) {
		chips.push(`Ht ${vitals.heightCm} cm`);
	}
	if (vitals.bmi !== null) {
		chips.push(`BMI ${vitals.bmi.toFixed(1)}`);
	}
	if (vitals.bloodGlucoseMgDl !== null) {
		chips.push(`CBG ${vitals.bloodGlucoseMgDl} mg/dL`);
	}
	if (vitals.painScore !== null) {
		chips.push(`Pain ${vitals.painScore}/10`);
	}
	return chips;
}

/** `Amlodipine (Norvasc) 5 mg tablet`. */
export function medicineName(
	item: Pick<PrescriptionItemFieldsFragment, 'genericName' | 'brandName' | 'strength' | 'form'>,
) {
	return [item.genericName, item.brandName && `(${item.brandName})`, item.strength, item.form]
		.filter(Boolean)
		.join(' ');
}

/** `1 tablet, once a day, for 30 days (oral)`. */
export function sig(item: Pick<PrescriptionItemFieldsFragment, 'dose' | 'frequency' | 'durationDays' | 'route'>) {
	return [item.dose, item.frequency, item.durationDays && `for ${item.durationDays} days`]
		.filter(Boolean)
		.join(', ')
		.concat(item.route === 'oral' ? '' : ` (${item.route})`);
}
