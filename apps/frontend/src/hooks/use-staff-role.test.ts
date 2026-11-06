import { describe, expect, it } from 'vitest';

import { ALL_DESKS, desksOf, staffRoleOf } from '@/hooks/use-staff-role';
import { deskNavLinks, roleNavLinks } from '@/lib/navigation';

describe('staff role', () => {
	it('maps clinic roles to desks', () => {
		expect(staffRoleOf(['MEDTECH'])).toBe('lab');
		expect(staffRoleOf(['RADTECH'])).toBe('lab');
		expect(staffRoleOf(['NURSE'])).toBe('nurse');
		expect(staffRoleOf(['MIDWIFE'])).toBe('nurse');
		expect(staffRoleOf(['RECEPTIONIST'])).toBe('front_desk');
		expect(staffRoleOf(['CASHIER'])).toBe('cashier');
		expect(staffRoleOf(['BILLING_CLERK'])).toBe('cashier');
		expect(staffRoleOf(['DOCTOR'])).toBe('doctor');
		expect(staffRoleOf(['PHARMACIST'])).toBe('pharmacy');
		expect(staffRoleOf(['PHARMACY_ASSISTANT'])).toBe('pharmacy');
		expect(staffRoleOf(['INVENTORY_CLERK'])).toBe('pharmacy');
	});

	it('keeps an admin who is a doctor a doctor, who can open every desk', () => {
		expect(staffRoleOf(['SUPER_ADMIN', 'ADMIN', 'DOCTOR'])).toBe('doctor');
		expect(desksOf(['SUPER_ADMIN', 'ADMIN', 'DOCTOR'])).toEqual([...ALL_DESKS]);
		expect(desksOf(['ADMIN', 'CASHIER'])[0]).toBe('cashier');
		expect(new Set(desksOf(['ADMIN', 'CASHIER']))).toEqual(new Set(ALL_DESKS));
	});

	it('gives staff without an admin role only their own desks', () => {
		expect(desksOf(['NURSE', 'CASHIER'])).toEqual(['nurse', 'cashier']);
		expect(desksOf(['NURSE', 'MIDWIFE'])).toEqual(['nurse']);
	});

	it('falls back to the doctor desk without a desk role', () => {
		expect(desksOf([])).toEqual(['doctor']);
		expect(staffRoleOf(['MEMBER'])).toBe('doctor');
	});

	it("puts the own desk's links first, then the home of each other desk", () => {
		const doctorLinks = roleNavLinks('doctor');
		const links = deskNavLinks(['doctor', 'lab']);
		expect(links.slice(0, doctorLinks.length)).toEqual(doctorLinks);
		const labHome = roleNavLinks('lab')[0];
		if (labHome) {
			expect(links.filter((link) => link.to === labHome.to)).toHaveLength(1);
		}
		expect(new Set(links.map((link) => link.to)).size).toBe(links.length);
	});
});
