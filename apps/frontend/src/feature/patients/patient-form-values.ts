import { patientDraftErrors } from '@loopwise/shared/patient-registration';
import type { PatientDraft, PatientLanguage, PatientSex } from '@loopwise/shared/patient-registration';
import type { PatientDraftInput } from '@/graphql/generated/graphql';

/** What the register form and the Wise card edit: every field as typed, before `PatientDraftSchema` parses it. */
export interface PatientFormValues {
	facilityId: string;
	givenName: string;
	familyName: string;
	birthDate: string;
	sex: PatientSex | '';
	phone: string;
	preferredLanguage: PatientLanguage;
	mrn: string;
	philHealthId: string;
}

export type PatientFormErrors = Partial<Record<keyof PatientFormValues, string>>;

export const emptyPatientForm = (facilityId = ''): PatientFormValues => ({
	facilityId,
	givenName: '',
	familyName: '',
	birthDate: '',
	sex: '',
	phone: '',
	preferredLanguage: 'en',
	mrn: '',
	philHealthId: '',
});

/** The same rules the API applies, plus the facility the form has to name. */
export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
	const errors: PatientFormErrors = patientDraftErrors({ ...values, sex: values.sex || undefined });
	if (!values.facilityId) {
		errors.facilityId = 'Choose the facility.';
	}
	return errors;
}

export function toPatientDraftInput(values: PatientFormValues): PatientDraftInput {
	const optional = (value: string) => (value.trim() ? value.trim() : null);
	return {
		facilityId: values.facilityId,
		givenName: values.givenName,
		familyName: values.familyName,
		birthDate: values.birthDate.trim(),
		sex: values.sex as PatientDraft['sex'],
		phone: optional(values.phone),
		preferredLanguage: values.preferredLanguage,
		mrn: optional(values.mrn),
		philHealthId: optional(values.philHealthId),
	};
}
