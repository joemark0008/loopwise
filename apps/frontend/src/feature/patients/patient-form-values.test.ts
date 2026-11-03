import { describe, expect, it } from 'vitest';

import { emptyPatientForm, toPatientDraftInput, validatePatientForm } from './patient-form-values';

const filled = {
	...emptyPatientForm('hc'),
	givenName: 'Maria',
	familyName: 'Santos',
	birthDate: '1981-03-04',
	sex: 'female' as const,
};

describe('patient form values', () => {
	it('uses the API rules, plus a required facility', () => {
		expect(validatePatientForm(filled)).toEqual({});
		expect(validatePatientForm({ ...filled, facilityId: '', phone: '123', sex: '' })).toEqual({
			facilityId: 'Choose the facility.',
			sex: 'Choose the sex.',
			phone: expect.stringMatching(/Philippine mobile/),
		});
	});

	it('sends blank optional fields as null', () => {
		expect(toPatientDraftInput({ ...filled, mrn: '  ', phone: '0917 123 4567' })).toEqual({
			facilityId: 'hc',
			givenName: 'Maria',
			familyName: 'Santos',
			birthDate: '1981-03-04',
			sex: 'female',
			phone: '0917 123 4567',
			preferredLanguage: 'en',
			mrn: null,
			philHealthId: null,
		});
	});
});
