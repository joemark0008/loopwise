import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PSGC_TAGBILARAN } from '../prisma/seed-reference.js';
import { BillingModule } from '../src/clinical/billing/billing.module.js';
import { ServiceItemService } from '../src/clinical/billing/service-items/service-item.service.js';
import { ClinicSetupModule } from '../src/clinical/clinics/clinic-setup.module.js';
import { DocumentSequenceService } from '../src/clinical/clinics/document-sequences/document-sequence.service.js';
import { PractitionerScheduleService } from '../src/clinical/practitioners/schedules/practitioner-schedule.service.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	CLINICAL_CORE_MODULES,
	createClinicalTestApp,
	graphql,
	resetDatabase,
	signIn,
	useTestDatabase,
} from './clinical-test-app.js';
import {
	type ClinicScene,
	createClinic,
	createClinicScene,
	createUser,
	type FixtureUser,
	grantClinicRoles,
} from './fixtures/clinic-fixtures.js';

const COGON = '0701242004';

/**
 * Clinic setup (Settings → Clinic): profile, numbering, practitioners with their hours and leaves, the service
 * catalog and clinic prices, and the expiring licenses. Admin only, audited, scoped to the selected clinic.
 */
describe('clinic setup (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;
	let admin: string[];
	let doctor: string[];
	let branchAdmin: FixtureUser;
	let year: number;

	beforeAll(async () => {
		const databaseUrl = useTestDatabase();
		await resetDatabase(databaseUrl);
		app = await createClinicalTestApp([...CLINICAL_CORE_MODULES, ClinicSetupModule, BillingModule]);
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
		// A clinic ADMIN who is neither the organization's admin nor a super admin.
		branchAdmin = await createUser(prisma);
		await grantClinicRoles(prisma, scene.clinic.id, branchAdmin.id, ['ADMIN']);
		admin = await signIn(app, scene.admin);
		doctor = await signIn(app, scene.doctor);
		year = Number(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 4));
	});

	afterAll(async () => {
		await app?.close();
	});

	const call = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		graphql(app, cookie, query, variables).set('x-loopwise-clinic-id', scene.clinic.id);
	const errorCode = (res: { body: { errors?: { extensions?: { errorCode?: string; code?: string } }[] } }) =>
		res.body.errors?.[0]?.extensions?.errorCode ?? res.body.errors?.[0]?.extensions?.code;
	const auditEvents = async (event: string) => prisma.auditLog.count({ where: { event, clinicId: scene.clinic.id } });

	describe('profile', () => {
		const UPDATE_CLINIC = `mutation ($input: UpdateClinicProfileInput!) {
			updateClinicProfile(input: $input) {
				clinic { code birBranchCode dohLicenseExpiry barangayName cityMunicipalityName provinceName zipCode }
			}
		}`;
		const clinicInput = (overrides: Record<string, unknown> = {}) => ({
			code: 'TAGX',
			name: 'Setup Test Clinic',
			birBranchCode: '00001',
			dohLicenseNo: 'SYN-LTO-1',
			dohLicenseExpiry: '2027-01-31',
			philhealthAccreditNo: 'SYN-PHA-1',
			philhealthAccreditExp: '2027-06-30',
			addressLine: 'CPG Avenue',
			cityMunicipalityCode: PSGC_TAGBILARAN.code,
			barangayCode: COGON,
			contactNo: '(038) 000-0000',
			email: 'clinic@loopwise.test',
			isActive: true,
			...overrides,
		});

		it('lets an admin update the clinic with a PSGC address, and audits it', async () => {
			const res = await call(admin, UPDATE_CLINIC, { input: clinicInput() });
			expect(res.body.errors).toBeUndefined();
			expect(res.body.data.updateClinicProfile.clinic).toEqual({
				code: 'TAGX',
				birBranchCode: '00001',
				dohLicenseExpiry: '2027-01-31',
				barangayName: 'Cogon',
				cityMunicipalityName: PSGC_TAGBILARAN.name,
				provinceName: 'Bohol',
				zipCode: PSGC_TAGBILARAN.zipCode,
			});
			expect(await auditEvents('clinic.update')).toBe(1);
		});

		it('refuses a barangay without its city, a code another clinic uses, and non-admins', async () => {
			expect(
				errorCode(await call(admin, UPDATE_CLINIC, { input: clinicInput({ cityMunicipalityCode: null }) })),
			).toBe('UNKNOWN_BARANGAY');
			await createClinic(prisma, { organizationId: scene.organization.id, code: 'OTHR' });
			expect(errorCode(await call(admin, UPDATE_CLINIC, { input: clinicInput({ code: 'OTHR' }) }))).toBe(
				'CLINIC_CODE_TAKEN',
			);
			expect(errorCode(await call(doctor, UPDATE_CLINIC, { input: clinicInput() }))).toBe('FORBIDDEN');
		});

		it("keeps the organization's legal details to its admin or a super admin", async () => {
			const UPDATE_ORG = `mutation ($input: UpdateOrganizationProfileInput!) {
				updateOrganizationProfile(input: $input) { organization { tin vatRegistration } canEditOrganization }
			}`;
			const input = { name: 'Synthetic Health Inc.', tin: '000-111-222-000', vatRegistration: 'VAT' };
			const res = await call(admin, UPDATE_ORG, { input });
			expect(res.body.data.updateOrganizationProfile).toEqual({
				organization: { tin: '000-111-222-000', vatRegistration: 'VAT' },
				canEditOrganization: true,
			});

			const branch = await signIn(app, branchAdmin);
			expect(errorCode(await call(branch, UPDATE_ORG, { input }))).toBe('ORGANIZATION_ADMIN_REQUIRED');
			const read = await call(branch, '{ clinicProfile { canEditOrganization organization { name } } }');
			expect(read.body.data.clinicProfile).toEqual({
				canEditOrganization: false,
				organization: { name: 'Synthetic Health Inc.' },
			});
		});
	});

	describe('numbering', () => {
		it('lists every numbered document and sets a format that carries into the next year', async () => {
			const list = await call(admin, '{ documentSequences { key prefix padLength preview isStarted } }');
			expect(list.body.errors).toBeUndefined();
			expect(list.body.data.documentSequences).toHaveLength(7);
			expect(list.body.data.documentSequences.find((s: { key: string }) => s.key === 'RX')).toMatchObject({
				prefix: `TAGX-RX-${year}-`,
				padLength: 6,
				isStarted: false,
			});

			const SET = `mutation ($input: SetDocumentSequenceInput!) {
				setDocumentSequence(input: $input) { prefix padLength preview }
			}`;
			expect(errorCode(await call(admin, SET, { input: { key: 'RX', prefix: 'RX-', padLength: 5 } }))).toBe(
				'INVALID_SEQUENCE_FORMAT',
			);
			expect(
				errorCode(await call(doctor, SET, { input: { key: 'RX', prefix: `RX${year}-`, padLength: 5 } })),
			).toBe('FORBIDDEN');
			const set = await call(admin, SET, { input: { key: 'RX', prefix: `RX/${year}/`, padLength: 4 } });
			expect(set.body.data.setDocumentSequence).toEqual({
				prefix: `RX/${year}/`,
				padLength: 4,
				preview: `RX/${year}/0001`,
			});

			const sequences = app.get(DocumentSequenceService);
			const db = app.get(ClinicalDbService);
			const clinic = { id: scene.clinic.id, code: 'TAGX' };
			const now = new Date();
			const nextYear = new Date(`${year + 1}-03-01T00:00:00+08:00`);
			const [thisYear, following] = await db.asUser(scene.admin.id, async (tx) => [
				await sequences.next(tx, clinic, 'RX', now),
				await sequences.next(tx, clinic, 'RX', nextYear),
			]);
			expect(thisYear).toBe(`RX/${year}/0001`);
			expect(following).toBe(`RX/${year + 1}/0001`);
			expect(await auditEvents('document_sequence.update')).toBe(1);
		});
	});

	describe('practitioners', () => {
		let visitingId = '';

		it('adds a visiting practitioner, links a user, and refuses a PRC license already used', async () => {
			const SAVE = `mutation ($input: SavePractitionerInput!) {
				savePractitioner(input: $input) { id userId displayName prcLicenseNo clinics { clinicId } }
			}`;
			const visiting = await call(admin, SAVE, {
				input: {
					firstName: 'Lorna',
					lastName: 'Villanueva',
					title: 'Dra.',
					postNominals: 'MD, FPOGS',
					specialty: 'Obstetrics and Gynecology',
					prcLicenseNo: 'SYN-9001',
					prcLicenseExpiry: '2026-12-01',
				},
			});
			expect(visiting.body.errors).toBeUndefined();
			visitingId = visiting.body.data.savePractitioner.id;
			expect(visiting.body.data.savePractitioner).toMatchObject({
				userId: null,
				displayName: 'Dra. Lorna Villanueva, MD, FPOGS',
				clinics: [{ clinicId: scene.clinic.id }],
			});

			const options = await call(admin, '{ practitionerUserOptions { id } }');
			expect(options.body.data.practitionerUserOptions.map((u: { id: string }) => u.id)).toContain(
				scene.otherDoctor.id,
			);
			const linked = await call(admin, SAVE, {
				input: { firstName: 'Carlo', lastName: 'Cruz', userId: scene.otherDoctor.id, prcLicenseNo: 'SYN-9002' },
			});
			expect(linked.body.data.savePractitioner.userId).toBe(scene.otherDoctor.id);
			expect(
				errorCode(
					await call(admin, SAVE, {
						input: { firstName: 'Dup', lastName: 'Licence', prcLicenseNo: 'SYN-9002' },
					}),
				),
			).toBe('PRC_LICENSE_TAKEN');
			expect(
				errorCode(
					await call(admin, SAVE, {
						input: {
							firstName: 'Two',
							lastName: 'Profiles',
							userId: scene.otherDoctor.id,
							prcLicenseNo: 'SYN-9003',
						},
					}),
				),
			).toBe('PRACTITIONER_USER_TAKEN');
			expect(await auditEvents('practitioner.create')).toBe(2);
		});

		it('sets room and fee, weekly hours without overlaps, and leaves that availability honours', async () => {
			const link = await call(
				admin,
				`mutation ($input: SetPractitionerClinicInput!) {
					setPractitionerClinic(input: $input) { roomName consultFee isActive }
				}`,
				{ input: { practitionerId: visitingId, roomName: 'Room 3', consultFee: 650, isActive: true } },
			);
			expect(link.body.data.setPractitionerClinic).toEqual({
				roomName: 'Room 3',
				consultFee: 650,
				isActive: true,
			});

			const SCHEDULE = `mutation ($input: PractitionerScheduleInput!) {
				savePractitionerSchedule(input: $input) { id dayOfWeek startTime endTime slotMinutes maxPatients }
			}`;
			const tuesday = {
				practitionerId: visitingId,
				dayOfWeek: 2,
				startTime: '09:00',
				endTime: '11:00',
				slotMinutes: 30,
			};
			const created = await call(admin, SCHEDULE, { input: { ...tuesday, maxPatients: 4 } });
			expect(created.body.data.savePractitionerSchedule).toMatchObject({ startTime: '09:00', maxPatients: 4 });
			expect(
				errorCode(await call(admin, SCHEDULE, { input: { ...tuesday, startTime: '10:30', endTime: '12:00' } })),
			).toBe('SCHEDULE_OVERLAP');
			expect(errorCode(await call(admin, SCHEDULE, { input: { ...tuesday, endTime: '08:00' } }))).toBe(
				'INVALID_SCHEDULE',
			);

			const leave = await call(
				admin,
				`mutation ($input: AddPractitionerLeaveInput!) { addPractitionerLeave(input: $input) { id startAt endAt } }`,
				{
					input: {
						practitionerId: visitingId,
						startDate: '2026-11-17',
						endDate: '2026-11-17',
						reason: 'Seminar',
					},
				},
			);
			expect(leave.body.data.addPractitionerLeave).toMatchObject({
				startAt: '2026-11-16T16:00:00.000Z',
				endAt: '2026-11-17T16:00:00.000Z',
			});
			const schedules = app.get(PractitionerScheduleService);
			const db = app.get(ClinicalDbService);
			const [onLeave, free] = await db.asUser(scene.doctor.id, async (tx) => [
				await schedules.availabilityFor(tx, visitingId, scene.clinic.id, '2026-11-17'),
				await schedules.availabilityFor(tx, visitingId, scene.clinic.id, '2026-11-24'),
			]);
			expect(onLeave.onLeave).toBe(true);
			expect(onLeave.sessions[0].slots).toEqual([]);
			expect(free.sessions[0].slots).toHaveLength(4);

			const page = await call(
				admin,
				'{ clinicPractitionerSetup { practitioner { id } roomName schedules { id } leaves { id } } }',
			);
			const entry = page.body.data.clinicPractitionerSetup.find(
				(row: { practitioner: { id: string } }) => row.practitioner.id === visitingId,
			);
			expect(entry).toMatchObject({ roomName: 'Room 3' });
			expect(entry.schedules).toHaveLength(1);
			expect(entry.leaves).toHaveLength(1);

			const removedLeave = await call(admin, 'mutation ($id: ID!) { removePractitionerLeave(id: $id) }', {
				id: leave.body.data.addPractitionerLeave.id,
			});
			expect(removedLeave.body.data.removePractitionerLeave).toBe(true);
			const removed = await call(admin, 'mutation ($id: ID!) { removePractitionerSchedule(id: $id) }', {
				id: created.body.data.savePractitionerSchedule.id,
			});
			expect(removed.body.data.removePractitionerSchedule).toBe(true);
			expect(await auditEvents('practitioner_leave.delete')).toBe(1);
			expect(await auditEvents('practitioner_schedule.delete')).toBe(1);
		});

		it("keeps another organization's admin out", async () => {
			const outsider = await createUser(prisma);
			const otherOrgClinic = await createClinic(prisma, {
				organizationId: (
					await prisma.organization.create({ data: { name: 'Other', slug: `other-${Date.now()}` } })
				).id,
				staff: [{ userId: outsider.id, roles: ['ADMIN'] }],
			});
			const cookie = await signIn(app, outsider);
			const res = await graphql(
				app,
				cookie,
				`
					mutation ($input: AddPractitionerLeaveInput!) {
						addPractitionerLeave(input: $input) {
							id
						}
					}
				`,
				{ input: { practitionerId: visitingId, startDate: '2026-12-01', endDate: '2026-12-01' } },
			).set('x-loopwise-clinic-id', otherOrgClinic.id);
			expect(errorCode(res)).toBe('ENTITY_NOT_FOUND');
		});
	});

	describe('services and prices', () => {
		it('adds a service, refuses a duplicate code, and sets the clinic price used by invoices', async () => {
			const SAVE = `mutation ($input: SaveServiceItemInput!) {
				saveServiceItem(input: $input) { id code price clinicPrice }
			}`;
			const input = {
				code: 'ECG-READ',
				name: 'ECG reading',
				category: 'PROCEDURE',
				defaultPrice: 400,
				taxType: 'VAT_EXEMPT',
				isPfShareable: true,
				isActive: true,
			};
			const created = await call(admin, SAVE, { input });
			expect(created.body.errors).toBeUndefined();
			const id = created.body.data.saveServiceItem.id;
			expect(created.body.data.saveServiceItem).toMatchObject({ price: 400, clinicPrice: null });
			expect(errorCode(await call(admin, SAVE, { input: { ...input, name: 'Again' } }))).toBe(
				'SERVICE_ITEM_CODE_TAKEN',
			);

			const priced = await call(
				admin,
				`mutation ($input: SetClinicServicePriceInput!) {
					setClinicServicePrice(input: $input) { price clinicPrice hmoPrice }
				}`,
				{ input: { serviceItemId: id, price: 350, hmoPrice: 500 } },
			);
			expect(priced.body.data.setClinicServicePrice).toEqual({ price: 350, clinicPrice: 350, hmoPrice: 500 });
			const priceList = await app
				.get(ClinicalDbService)
				.asUser(scene.admin.id, (tx) =>
					app
						.get(ServiceItemService)
						.priceList(tx, { id: scene.clinic.id, organizationId: scene.organization.id }),
				);
			expect(priceList.find((item) => item.id === id)?.price).toBe(350);

			const removed = await call(
				admin,
				'mutation ($id: ID!) { removeClinicServicePrice(serviceItemId: $id) { price clinicPrice } }',
				{ id },
			);
			expect(removed.body.data.removeClinicServicePrice).toEqual({ price: 400, clinicPrice: null });
			expect(await auditEvents('service_item.create')).toBe(1);
			expect(await auditEvents('clinic_service_price.remove')).toBe(1);
			expect(errorCode(await call(doctor, '{ serviceCatalog { id } }'))).toBe('FORBIDDEN');
		});
	});

	describe('expiring licenses', () => {
		it('lists the licenses expiring within the window, soonest first', async () => {
			// Calendar dates counted from today in the Philippines, as the service counts them.
			const manilaToday = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
			const soon = (days: number) => new Date(Date.parse(`${manilaToday}T00:00:00Z`) + days * 86_400_000);
			await prisma.practitioner.update({
				where: { id: scene.doctorPractitioner.id },
				data: { s2LicenseNo: 'SYN-S2-1', s2LicenseExpiry: soon(10), prcLicenseExpiry: soon(200) },
			});
			await prisma.clinic.update({ where: { id: scene.clinic.id }, data: { dohLicenseExpiry: soon(-3) } });
			const res = await call(admin, '{ expiringCredentials { kind subjectId daysLeft } }');
			expect(res.body.errors).toBeUndefined();
			const rows: { kind: string; subjectId: string; daysLeft: number }[] = res.body.data.expiringCredentials;
			expect(rows[0]).toEqual({ kind: 'DOH_LICENSE', subjectId: scene.clinic.id, daysLeft: -3 });
			expect(rows).toContainEqual({ kind: 'S2_LICENSE', subjectId: scene.doctorPractitioner.id, daysLeft: 10 });
			expect(rows.map((row) => row.kind)).not.toContain('PHILHEALTH_ACCREDITATION');
			expect(rows.filter((row) => row.subjectId === scene.doctorPractitioner.id)).toHaveLength(1);
		});
	});
});
