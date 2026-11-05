import { describe, expect, it } from 'vitest';

import { normalizeName, normalizePhone, patientDraftErrors, PatientDraftSchema } from './patient-registration';

const valid = { givenName: '  Maria ', familyName: 'Dela  Cruz', birthDate: '1980-05-02', sex: 'FEMALE' };

describe('PatientDraftSchema', () => {
	it('trims names, defaults the language and drops empty optional fields', () => {
		expect(PatientDraftSchema.parse({ ...valid, phone: ' ', patientNo: '' })).toEqual({
			givenName: 'Maria',
			familyName: 'Dela Cruz',
			birthDate: '1980-05-02',
			sex: 'FEMALE',
			preferredLanguage: 'en',
		});
	});

	it('normalises a Philippine mobile number and upper-cases PhilHealth numbers', () => {
		const draft = PatientDraftSchema.parse({ ...valid, phone: '0917 123 4567', philHealthId: 'syn-0000-0042' });
		expect(draft.phone).toBe('+639171234567');
		expect(draft.philHealthId).toBe('SYN-0000-0042');
	});

	it('rejects impossible, future and ancient birth dates', () => {
		expect(patientDraftErrors({ ...valid, birthDate: '1980-02-30' }).birthDate).toBe('Not a real date.');
		expect(patientDraftErrors({ ...valid, birthDate: '2999-01-01' }).birthDate).toMatch(/future/);
		expect(patientDraftErrors({ ...valid, birthDate: '1850-01-01' }).birthDate).toMatch(/past/);
	});

	it('reports one message per invalid field', () => {
		expect(patientDraftErrors({ givenName: '', phone: '12345', philHealthId: '123' })).toEqual({
			givenName: 'Add the given name.',
			familyName: expect.any(String),
			birthDate: expect.any(String),
			sex: 'Choose the sex.',
			phone: expect.stringMatching(/Philippine mobile/),
			philHealthId: expect.stringMatching(/PhilHealth/),
		});
	});
});

describe('normalizers', () => {
	it('compares names case- and space-insensitively', () => {
		expect(normalizeName('  MARIA  de la ')).toBe('maria de la');
	});

	it('accepts +63 and 09 mobile numbers only', () => {
		expect(normalizePhone('+63 917-123-4567')).toBe('+639171234567');
		expect(normalizePhone('038 411 1234')).toBeNull();
	});
});
