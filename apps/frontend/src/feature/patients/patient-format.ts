import { PATIENT_LANGUAGES } from '@quarry/shared/patient-registration';
import type { PatientFieldsFragment } from '@/graphql/generated/graphql';

export const patientName = (patient: Pick<PatientFieldsFragment, 'givenName' | 'familyName'>) =>
	`${patient.givenName} ${patient.familyName}`;

/** Age in whole years on `today`, from a YYYY-MM-DD birth date. */
export function ageOf(birthDate: string, today = new Date()): number {
	const [year, month, day] = birthDate.split('-').map(Number);
	const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
	return today.getFullYear() - year - (hadBirthday ? 0 : 1);
}

/** `45 F`, or months and days for the youngest: `7 mo F`, `12 d M`. */
export function ageLabel(birthDate: string, sex: PatientFieldsFragment['sex'], today = new Date()): string {
	const years = ageOf(birthDate, today);
	if (years >= 2) {
		return `${years} ${sexLetter(sex)}`;
	}
	const born = new Date(`${birthDate}T00:00:00`);
	const months =
		(today.getFullYear() - born.getFullYear()) * 12 +
		today.getMonth() -
		born.getMonth() -
		(today.getDate() < born.getDate() ? 1 : 0);
	if (months >= 1) {
		return `${months} mo ${sexLetter(sex)}`;
	}
	const days = Math.max(0, Math.floor((today.getTime() - born.getTime()) / 86_400_000));
	return `${days} d ${sexLetter(sex)}`;
}

export const sexLetter = (sex: PatientFieldsFragment['sex']) =>
	({ female: 'F', male: 'M', other: 'X', unknown: '?' })[sex];

export const languageLabel = (value: string) =>
	PATIENT_LANGUAGES.find((language) => language.value === value)?.label ?? value;

/** `MRN THC-0001 · PhilHealth SYN-0000-0001` */
export const identifierSummary = (patient: Pick<PatientFieldsFragment, 'identifiers'>) =>
	patient.identifiers.map((identifier) => `${identifier.system} ${identifier.value}`).join(' · ');

/** The values of one identifier system (`MRN`, `PhilHealth`), in the order they were recorded. */
export const identifierValues = (patient: Pick<PatientFieldsFragment, 'identifiers'>, system: string) =>
	patient.identifiers.filter((identifier) => identifier.system === system).map((identifier) => identifier.value);

/** `MS` for Maria Santos. */
export const patientInitials = (patient: Pick<PatientFieldsFragment, 'givenName' | 'familyName'>) =>
	`${patient.givenName.trim().charAt(0)}${patient.familyName.trim().charAt(0)}`.toUpperCase();
