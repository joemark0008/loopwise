import type { Prisma } from '../src/generated/prisma/client.js';
import { DEMO_CLINIC_CODE, DEMO_ORG_SLUG, type DemoContext } from './seed-clinical.js';

/**
 * The demo clinic's setup (synthetic): the organization's and the clinic's registrations (TIN, DOH License to
 * Operate, PhilHealth accreditation; fake numbers), the doctors' rooms, consult fees and weekly clinic hours, one
 * leave next week, credential expiries (a few inside the 60-day warning window), and the clinic's own prices for two
 * services (a lower follow-up fee, an HMO rate). Dates are relative to the day the seed runs.
 */
export async function seedClinicSetup(tx: Prisma.TransactionClient, demo: DemoContext): Promise<void> {
	const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
	const clinic = await tx.clinic.findFirstOrThrow({
		where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
	});

	await tx.organization.update({
		where: { id: organization.id },
		data: { tin: '000-123-456-000', vatRegistration: 'NON_VAT', secOrDtiNo: 'SYN-DTI-0001' },
	});
	await tx.clinic.update({
		where: { id: clinic.id },
		data: {
			birBranchCode: '00000',
			dohLicenseNo: 'SYN-LTO-07-0001',
			dohLicenseExpiry: inDays(45),
			philhealthAccreditNo: 'SYN-PHA-0001',
			philhealthAccreditExp: inDays(220),
			email: 'tagbilaran.hc@loopwise.test',
		},
	});

	const credentials: Record<keyof DemoContext['practitioners'], Prisma.PractitionerUpdateInput> = {
		admin: { prcLicenseExpiry: inDays(600), philhealthPanExpiry: inDays(300) },
		doctor: {
			prcLicenseExpiry: inDays(400),
			s2LicenseNo: 'SYN-S2-0001',
			s2LicenseExpiry: inDays(25),
			philhealthPanExpiry: inDays(180),
		},
		internist: { prcLicenseExpiry: inDays(50), philhealthPanExpiry: inDays(-10), tin: '000-222-333-000' },
	};
	const fees: Record<keyof DemoContext['practitioners'], number> = { admin: 300, doctor: 300, internist: 500 };
	for (const key of Object.keys(credentials) as (keyof DemoContext['practitioners'])[]) {
		const practitionerId = demo.practitioners[key];
		await tx.practitioner.update({ where: { id: practitionerId }, data: credentials[key] });
		await tx.practitionerClinic.update({
			where: { practitionerId_clinicId: { practitionerId, clinicId: clinic.id } },
			data: { consultFee: fees[key] },
		});
	}

	const WEEKDAYS = [1, 2, 3, 4, 5];
	const sessions: {
		key: keyof DemoContext['practitioners'];
		days: number[];
		start: string;
		end: string;
		slotMinutes: number;
		maxPatients: number | null;
	}[] = [
		{ key: 'doctor', days: WEEKDAYS, start: '08:00', end: '12:00', slotMinutes: 15, maxPatients: 16 },
		{ key: 'doctor', days: [1, 3], start: '13:00', end: '17:00', slotMinutes: 15, maxPatients: 16 },
		{ key: 'internist', days: [2, 4], start: '09:00', end: '12:00', slotMinutes: 20, maxPatients: 9 },
		{ key: 'internist', days: [6], start: '08:00', end: '11:00', slotMinutes: 20, maxPatients: null },
		{ key: 'admin', days: [3], start: '13:00', end: '16:00', slotMinutes: 30, maxPatients: 6 },
	];
	await tx.practitionerSchedule.createMany({
		data: sessions.flatMap(({ key, days, start, end, slotMinutes, maxPatients }) =>
			days.map((dayOfWeek) => ({
				practitionerId: demo.practitioners[key],
				clinicId: clinic.id,
				dayOfWeek,
				startTime: new Date(`1970-01-01T${start}:00Z`),
				endTime: new Date(`1970-01-01T${end}:00Z`),
				slotMinutes,
				maxPatients,
			})),
		),
	});

	// Dr. Cruz is at a conference for two days next week (whole Philippine days).
	const leaveStart = manilaMidnight(7);
	await tx.practitionerLeave.create({
		data: {
			practitionerId: demo.practitioners.internist,
			startAt: leaveStart,
			endAt: new Date(leaveStart.getTime() + 2 * DAY_MS),
			reason: 'PCP annual convention',
		},
	});

	const priced = await tx.serviceItem.findMany({
		where: { organizationId: organization.id, code: { in: ['CONSULT', 'CONSULT-FU'] } },
	});
	for (const item of priced) {
		await tx.clinicServicePrice.update({
			where: { serviceItemId_clinicId: { serviceItemId: item.id, clinicId: clinic.id } },
			data: item.code === 'CONSULT' ? { hmoPrice: 400 } : { price: 180 },
		});
	}
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar date `days` from today (a `date` column). */
function inDays(days: number): Date {
	return new Date(`${new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)}T00:00:00Z`);
}

/** Midnight in the Philippines, `days` from today. */
function manilaMidnight(days: number): Date {
	const manilaToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
	return new Date(new Date(`${manilaToday}T00:00:00+08:00`).getTime() + days * DAY_MS);
}
