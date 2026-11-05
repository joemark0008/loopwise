import { patientDraftErrors } from '@loopwise/shared/patient-registration';
import type { PatientDraft, PatientLanguage, PatientSex } from '@loopwise/shared/patient-registration';
import type { PatientDraftInput } from '@/graphql/generated/graphql';

/** What the register form and the Wise card edit: every field as typed, before `PatientDraftSchema` parses it. */
export interface PatientFormValues {
	clinicId: string;
	givenName: string;
	middleName: string;
	familyName: string;
	birthDate: string;
	sex: PatientSex | '';
	phone: string;
	preferredLanguage: PatientLanguage;
	/** An existing chart number to keep; empty, the clinic assigns the next patient number. */
	patientNo: string;
	philHealthId: string;
	/** PSGC code of the barangay of residence. */
	barangayCode: string;
	addressLine: string;
}

export type PatientFormErrors = Partial<Record<keyof PatientFormValues, string>>;

export const emptyPatientForm = (clinicId = ''): PatientFormValues => ({
	clinicId,
	givenName: '',
	middleName: '',
	familyName: '',
	birthDate: '',
	sex: '',
	phone: '',
	preferredLanguage: 'en',
	patientNo: '',
	philHealthId: '',
	barangayCode: '',
	addressLine: '',
});

/** The same rules the API applies, plus the clinic the form has to name. */
export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
	const errors: PatientFormErrors = patientDraftErrors({ ...values, sex: values.sex || undefined });
	if (!values.clinicId) {
		errors.clinicId = 'Choose the clinic.';
	}
	return errors;
}

export function toPatientDraftInput(values: PatientFormValues): PatientDraftInput {
	const optional = (value: string) => (value.trim() ? value.trim() : null);
	return {
		clinicId: values.clinicId,
		givenName: values.givenName,
		middleName: optional(values.middleName),
		familyName: values.familyName,
		birthDate: values.birthDate.trim(),
		sex: values.sex as PatientDraft['sex'],
		phone: optional(values.phone),
		preferredLanguage: values.preferredLanguage,
		patientNo: optional(values.patientNo),
		philHealthId: optional(values.philHealthId),
		barangayCode: optional(values.barangayCode),
		addressLine: optional(values.addressLine),
	};
}
