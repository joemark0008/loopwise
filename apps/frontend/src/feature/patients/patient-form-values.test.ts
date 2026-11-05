import { describe, expect, it } from 'vitest';

import { emptyPatientForm, toPatientDraftInput, validatePatientForm } from './patient-form-values';

const filled = {
	...emptyPatientForm('clinic-1'),
	givenName: 'Maria',
	familyName: 'Santos',
	birthDate: '1981-03-04',
	sex: 'FEMALE' as const,
};

describe('patient form values', () => {
	it('uses the API rules, plus a required clinic', () => {
		expect(validatePatientForm(filled)).toEqual({});
		expect(validatePatientForm({ ...filled, clinicId: '', phone: '123', sex: '' })).toEqual({
			clinicId: 'Choose the clinic.',
			sex: 'Choose the sex.',
			phone: expect.stringMatching(/Philippine mobile/),
		});
	});

	it('sends blank optional fields as null', () => {
		expect(
			toPatientDraftInput({ ...filled, patientNo: '  ', phone: '0917 123 4567', barangayCode: '071242001' }),
		).toEqual({
			clinicId: 'clinic-1',
			givenName: 'Maria',
			middleName: null,
			familyName: 'Santos',
			birthDate: '1981-03-04',
			sex: 'FEMALE',
			phone: '0917 123 4567',
			preferredLanguage: 'en',
			patientNo: null,
			philHealthId: null,
			barangayCode: '071242001',
			addressLine: null,
		});
	});
});
