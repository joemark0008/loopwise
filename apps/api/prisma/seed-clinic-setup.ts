import type { Prisma } from '../src/generated/prisma/client.js';
import { DEMO_CLINIC_CODE, DEMO_ORG_SLUG, type DemoPractitionerKey } from './seed-clinical.js';

/**
 * The demo clinic's setup (synthetic): the organization's and the clinic's registrations (TIN, DOH License to
 * Operate, PhilHealth accreditation; fake numbers), the doctors' consult fees and weekly clinic hours, one leave next
 * week, credential expiries (a few inside the 60-day warning window), and the clinic's own prices for two services (a
 * lower follow-up fee, an HMO rate). Dates are relative to the day the seed runs.
 *
 * Fill-if-empty, so it also runs on a database seeded before it (`npm run db:seed:clinic-setup`): a value someone
 * already set is kept, hours are only added for a practitioner with none at TAG, and the leave once.
 */
export async function seedClinicSetup(
	tx: Prisma.TransactionClient,
	practitioners: Record<DemoPractitionerKey, string>,
): Promise<void> {
	const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
	const clinic = await tx.clinic.findFirstOrThrow({
		where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
	});

	await tx.organization.update({
		where: { id: organization.id },
		data: fillEmpty(organization, { tin: '000-123-456-000', secOrDtiNo: 'SYN-DTI-0001' }),
	});
	await tx.clinic.update({
		where: { id: clinic.id },
		data: fillEmpty(clinic, {
			birBranchCode: '00000',
			dohLicenseNo: 'SYN-LTO-07-0001',
			dohLicenseExpiry: inDays(45),
			philhealthAccreditNo: 'SYN-PHA-0001',
			philhealthAccreditExp: inDays(220),
			email: 'tagbilaran.hc@loopwise.test',
		}),
	});

	const credentials: Record<DemoPractitionerKey, Partial<Prisma.PractitionerUncheckedUpdateInput>> = {
		admin: { prcLicenseExpiry: inDays(600), philhealthPanExpiry: inDays(300) },
		doctor: {
			prcLicenseExpiry: inDays(400),
			s2LicenseNo: 'SYN-S2-0001',
			s2LicenseExpiry: inDays(25),
			philhealthPanExpiry: inDays(180),
		},
		internist: { prcLicenseExpiry: inDays(50), philhealthPanExpiry: inDays(-10), tin: '000-222-333-000' },
	};
	const fees: Record<DemoPractitionerKey, number> = { admin: 300, doctor: 300, internist: 500 };
	for (const key of Object.keys(credentials) as DemoPractitionerKey[]) {
		const practitionerId = practitioners[key];
		const practitioner = await tx.practitioner.findUniqueOrThrow({ where: { id: practitionerId } });
		await tx.practitioner.update({
			where: { id: practitionerId },
			data: fillEmpty(practitioner, credentials[key]),
		});
		const link = await tx.practitionerClinic.upsert({
			where: { practitionerId_clinicId: { practitionerId, clinicId: clinic.id } },
			create: { practitionerId, clinicId: clinic.id, consultFee: fees[key] },
			update: {},
		});
		if (link.consultFee === null) {
			await tx.practitionerClinic.update({
				where: { practitionerId_clinicId: { practitionerId, clinicId: clinic.id } },
				data: { consultFee: fees[key] },
			});
		}
	}

	// Dr. Reyes and the admin doctor hold clinic every day, so the booking demo and its e2e specs always find slots.
	const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
	const HOURS: Record<DemoPractitionerKey, [number[], string, string, number, number | null][]> = {
		doctor: [
			[EVERY_DAY, '08:00', '12:00', 15, 16],
			[EVERY_DAY, '13:00', '17:00', 15, null],
		],
		internist: [
			[[2, 4], '09:00', '12:00', 20, 9],
			[[6], '08:00', '11:00', 20, null],
		],
		admin: [[EVERY_DAY, '06:00', '23:30', 15, null]],
	};
	for (const key of Object.keys(HOURS) as DemoPractitionerKey[]) {
		const practitionerId = practitioners[key];
		if (await tx.practitionerSchedule.count({ where: { practitionerId, clinicId: clinic.id } })) {
			continue;
		}
		await tx.practitionerSchedule.createMany({
			data: HOURS[key].flatMap(([days, start, end, slotMinutes, maxPatients]) =>
				days.map((dayOfWeek) => ({
					practitionerId,
					clinicId: clinic.id,
					dayOfWeek,
					startTime: new Date(`1970-01-01T${start}:00Z`),
					endTime: new Date(`1970-01-01T${end}:00Z`),
					slotMinutes,
					maxPatients,
				})),
			),
		});
	}

	// Dr. Cruz is at a conference for two days next week (whole Philippine days).
	const LEAVE_REASON = 'PCP annual convention';
	if (
		!(await tx.practitionerLeave.count({
			where: { practitionerId: practitioners.internist, reason: LEAVE_REASON },
		}))
	) {
		const leaveStart = manilaMidnight(7);
		await tx.practitionerLeave.create({
			data: {
				practitionerId: practitioners.internist,
				startAt: leaveStart,
				endAt: new Date(leaveStart.getTime() + 2 * DAY_MS),
				reason: LEAVE_REASON,
			},
		});
	}

	const items = await tx.serviceItem.findMany({
		where: { organizationId: organization.id, code: { in: ['CONSULT', 'CONSULT-FU'] } },
	});
	for (const item of items) {
		const where = { serviceItemId_clinicId: { serviceItemId: item.id, clinicId: clinic.id } };
		const price = await tx.clinicServicePrice.findUnique({ where });
		if (item.code === 'CONSULT' && !price?.hmoPrice) {
			await tx.clinicServicePrice.upsert({
				where,
				create: { serviceItemId: item.id, clinicId: clinic.id, price: item.defaultPrice, hmoPrice: 400 },
				update: { hmoPrice: 400 },
			});
		}
		if (item.code === 'CONSULT-FU' && (!price || price.price.equals(item.defaultPrice))) {
			await tx.clinicServicePrice.upsert({
				where,
				create: { serviceItemId: item.id, clinicId: clinic.id, price: 180 },
				update: { price: 180 },
			});
		}
	}
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The values of `data` whose column is still empty in `row`. */
function fillEmpty<T extends object>(row: Record<string, unknown>, data: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(data).filter(([key]) => row[key] === null || row[key] === undefined),
	) as Partial<T>;
}

/** A calendar date `days` from today in the Philippines (a `date` column). */
function inDays(days: number): Date {
	const manilaToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
	return new Date(Date.parse(`${manilaToday}T00:00:00Z`) + days * DAY_MS);
}

/** Midnight in the Philippines, `days` from today. */
function manilaMidnight(days: number): Date {
	const manilaToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
	return new Date(new Date(`${manilaToday}T00:00:00+08:00`).getTime() + days * DAY_MS);
}
