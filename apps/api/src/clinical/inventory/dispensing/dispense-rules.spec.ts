import { describe, expect, it } from 'vitest';

import { isPrescribedProduct, isSameGeneric, isSameStrength, s2Missing } from './dispense-rules.js';

describe('dispense rules', () => {
	it('matches the generic name whatever the case and spacing', () => {
		expect(isSameGeneric('Amoxicillin', 'amoxicillin ')).toBe(true);
		expect(isSameGeneric('Amoxicillin', 'Co-amoxiclav')).toBe(false);
		expect(isSameGeneric('Amoxicillin', null)).toBe(false);
		expect(isSameStrength('500 mg', '500mg')).toBe(true);
		expect(isSameStrength('500 mg', '250 mg')).toBe(false);
		expect(isSameStrength(null, '250 mg')).toBe(true);
	});

	it('treats another brand of the generic as a substitution', () => {
		expect(
			isPrescribedProduct({ inventoryItemId: 'amoxil', brandName: null }, { id: 'amoxil', brandName: null }),
		).toBe(true);
		expect(
			isPrescribedProduct({ inventoryItemId: 'amoxil', brandName: null }, { id: 'generic', brandName: null }),
		).toBe(false);
		expect(
			isPrescribedProduct({ inventoryItemId: null, brandName: 'Amoxil' }, { id: 'x', brandName: 'amoxil' }),
		).toBe(true);
		expect(isPrescribedProduct({ inventoryItemId: null, brandName: 'Amoxil' }, { id: 'x', brandName: null })).toBe(
			false,
		);
		expect(isPrescribedProduct({ inventoryItemId: null, brandName: null }, { id: 'x', brandName: 'Himox' })).toBe(
			true,
		);
	});

	it('lists what a dangerous-drug prescription still needs (RA 9165)', () => {
		expect(s2Missing({ s2FormSerialNo: null, prescriberS2LicenseNo: null, dangerousLines: [] })).toBeNull();
		expect(
			s2Missing({
				s2FormSerialNo: 'S2-0001',
				prescriberS2LicenseNo: 'S2-LIC-1',
				dangerousLines: [{ genericName: 'Tramadol', quantityInWords: 'ten (10)' }],
			}),
		).toBeNull();
		expect(
			s2Missing({
				s2FormSerialNo: ' ',
				prescriberS2LicenseNo: null,
				dangerousLines: [{ genericName: 'Tramadol', quantityInWords: null }],
			}),
		).toBe("the S2 form serial number, the prescriber's S2 license number, the quantity in words for Tramadol");
	});
});
