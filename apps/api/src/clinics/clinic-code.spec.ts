import { describe, expect, it } from 'vitest';

import { clinicCodeFromName } from './clinic-code.js';

describe('clinicCodeFromName', () => {
	it('takes the initials of a name of several words', () => {
		expect(clinicCodeFromName('Tagbilaran City Health Center', new Set())).toBe('TCHC');
	});

	it('takes the first three letters of a one-word name', () => {
		expect(clinicCodeFromName('Tagbilaran', new Set())).toBe('TAG');
	});

	it('drops accents, apostrophes and punctuation', () => {
		expect(clinicCodeFromName('Peñaflor', new Set())).toBe('PEN');
		expect(clinicCodeFromName("St. Luke's - Bohol", new Set())).toBe('SLB');
	});

	it('appends a number while the code is taken', () => {
		expect(clinicCodeFromName('Tagbilaran', new Set(['TAG', 'TAG2']))).toBe('TAG3');
	});

	it('falls back to CLN for a name without letters', () => {
		expect(clinicCodeFromName('---', new Set())).toBe('CLN');
	});
});
