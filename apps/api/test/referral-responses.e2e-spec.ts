import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DocumentsModule } from '../src/clinical/documents/documents.module.js';
import type { Practitioner } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
	CLINICAL_CORE_MODULES,
	createClinicalTestApp,
	graphql,
	resetDatabase,
	signIn,
	useTestDatabase,
} from './clinical-test-app.js';
import { type ClinicScene, createClinicScene, createPractitioner } from './fixtures/clinic-fixtures.js';

const REFERRAL_FIELDS = `id status isInternal patientName patientNo encounterNo responseNotes respondedAt
	toPractitioner { id } fromPractitioner { id }`;
const CREATE = `mutation ($input: CreateReferralInput!) { createReferral(input: $input) { ${REFERRAL_FIELDS} } }`;
const ACCEPT = `mutation ($input: AcceptReferralInput!) { acceptReferral(input: $input) { ${REFERRAL_FIELDS} } }`;
const DECLINE = `mutation ($input: DeclineReferralInput!) { declineReferral(input: $input) { ${REFERRAL_FIELDS} } }`;
const COMPLETE = `mutation ($input: CompleteReferralInput!) { completeReferral(input: $input) { ${REFERRAL_FIELDS} } }`;
const LIST = `query ($input: ReferralsInput!) { referrals(input: $input) { ${REFERRAL_FIELDS} } }`;
const LETTER = `query ($id: ID!) { referralLetter(id: $id) {
	referral { id reason urgency clinicalSummary }
	signatory { name licenseNumber ptrNumber facilityName } } }`;

/**
 * Referral answers against Postgres: an internal referral is accepted and completed by the doctor it was sent to
 * (nobody else), an external one is marked by the referring clinic, each answer is one status transition that stamps
 * `responded_at` and writes its audit row; the inbox, outbox and the clinic list (admins), and the printed letter.
 */
describe('referral responses (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let scene: ClinicScene;
	let receiving: Practitioner;
	const cookies: Record<'doctor' | 'other' | 'admin', string[]> = { doctor: [], other: [], admin: [] };
	let internalId: string;
	let externalId: string;

	const run = (who: keyof typeof cookies, query: string, variables: Record<string, unknown>) =>
		graphql(app, cookies[who], query, variables);
	const ok = async (who: keyof typeof cookies, query: string, variables: Record<string, unknown>) => {
		const res = await run(who, query, variables);
		expect(res.body.errors).toBeUndefined();
		return Object.values(res.body.data as Record<string, unknown>)[0] as Record<string, never>;
	};
	const errorCode = async (who: keyof typeof cookies, query: string, variables: Record<string, unknown>) =>
		(await run(who, query, variables)).body.errors?.[0]?.extensions?.errorCode;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createClinicalTestApp([...CLINICAL_CORE_MODULES, DocumentsModule]);
		prisma = app.get(PrismaService);
		scene = await createClinicScene(prisma);
		receiving = await createPractitioner(prisma, { userId: scene.otherDoctor.id, clinicIds: [scene.clinic.id] });
		cookies.doctor = await signIn(app, scene.doctor);
		cookies.other = await signIn(app, scene.otherDoctor);
		cookies.admin = await signIn(app, scene.admin);

		internalId = (
			await ok('doctor', CREATE, {
				input: {
					encounterId: scene.encounter.id,
					toPractitionerId: receiving.id,
					reason: 'HbA1c 7.2%: please evaluate and start treatment.',
					clinicalSummary: 'Fatigue and polyuria for 2 weeks.',
				},
			})
		).id;
		externalId = (
			await ok('doctor', CREATE, {
				input: {
					encounterId: scene.encounter.id,
					toExternalDoctor: 'Dr. Lorna Pacana (Ophthalmology)',
					reason: 'Diabetic eye screening.',
				},
			})
		).id;
	});

	afterAll(async () => {
		await app?.close();
	});

	it("lists an internal referral in the receiving doctor's inbox and both in the referring doctor's outbox", async () => {
		const inbox = (await ok('other', LIST, { input: { box: 'INBOX' } })) as unknown as Record<string, unknown>[];
		expect(inbox).toEqual([
			expect.objectContaining({
				id: internalId,
				status: 'SENT',
				isInternal: true,
				patientName: 'Maria Santos',
				encounterNo: scene.encounter.encounterNo,
			}),
		]);
		const outbox = (await ok('doctor', LIST, { input: { box: 'OUTBOX' } })) as unknown as { id: string }[];
		expect(outbox.map((referral) => referral.id).sort()).toEqual([internalId, externalId].sort());
		expect(await ok('doctor', LIST, { input: { box: 'INBOX' } })).toEqual([]);
	});

	it('lets only the receiving doctor accept and complete an internal referral, one step at a time', async () => {
		expect(await errorCode('doctor', ACCEPT, { input: { id: internalId } })).toBe('NOT_REFERRAL_RECIPIENT');
		expect(await errorCode('other', COMPLETE, { input: { id: internalId, responseNotes: 'Seen' } })).toBe(
			'INVALID_STATUS_TRANSITION',
		);

		const accepted = await ok('other', ACCEPT, { input: { id: internalId, notes: 'Seen on Thursday at IM.' } });
		expect(accepted).toMatchObject({ status: 'ACCEPTED', responseNotes: 'Seen on Thursday at IM.' });
		expect(accepted.respondedAt).toBeTruthy();
		expect(await errorCode('other', ACCEPT, { input: { id: internalId } })).toBe('INVALID_STATUS_TRANSITION');
		expect(await errorCode('other', COMPLETE, { input: { id: internalId, responseNotes: '  ' } })).toBe(
			'REFERRAL_RESPONSE_REQUIRED',
		);

		const completed = await ok('other', COMPLETE, {
			input: { id: internalId, responseNotes: 'Type 2 diabetes confirmed; metformin started. Back to you.' },
		});
		expect(completed).toMatchObject({ status: 'COMPLETED', responseNotes: expect.stringContaining('metformin') });

		const events = await prisma.auditLog.findMany({
			where: { entityId: internalId },
			orderBy: { createdAt: 'asc' },
			select: { event: true, userId: true },
		});
		expect(events).toEqual([
			{ event: 'referral.create', userId: scene.doctor.id },
			{ event: 'referral.accept', userId: scene.otherDoctor.id },
			{ event: 'referral.complete', userId: scene.otherDoctor.id },
		]);
	});

	it('lets the referring clinic mark an external referral declined, with the reason', async () => {
		expect(await errorCode('doctor', DECLINE, { input: { id: externalId, reason: ' ' } })).toBe(
			'REFERRAL_RESPONSE_REQUIRED',
		);
		const declined = await ok('doctor', DECLINE, {
			input: { id: externalId, reason: 'Patient prefers the eye center in Cebu.' },
		});
		expect(declined).toMatchObject({ status: 'DECLINED', isInternal: false });
		expect(
			await prisma.auditLog.findFirst({ where: { entityId: externalId, event: 'referral.decline' } }),
		).toMatchObject({ reason: 'Patient prefers the eye center in Cebu.', userId: scene.doctor.id });
		expect(await errorCode('doctor', ACCEPT, { input: { id: externalId } })).toBe('INVALID_STATUS_TRANSITION');
	});

	it("shows a clinic's every referral to its admins only", async () => {
		expect(await errorCode('doctor', LIST, { input: { box: 'CLINIC', clinicId: scene.clinic.id } })).toBe(
			'CLINIC_REFERRALS_ACCESS',
		);
		const all = (await ok('admin', LIST, {
			input: { box: 'CLINIC', clinicId: scene.clinic.id, statuses: ['COMPLETED', 'DECLINED'] },
		})) as unknown as { id: string }[];
		expect(all).toHaveLength(2);
	});

	it("prints the letter with the referring doctor's PRC and PTR on the clinic letterhead, audited", async () => {
		const letter = await ok('doctor', LETTER, { id: internalId });
		expect(letter).toMatchObject({
			referral: { id: internalId, urgency: 'ROUTINE', clinicalSummary: 'Fatigue and polyuria for 2 weeks.' },
			signatory: {
				licenseNumber: scene.doctorPractitioner.prcLicenseNo,
				ptrNumber: scene.doctorPractitioner.ptrNo,
				facilityName: scene.clinic.name,
			},
		});
		expect(
			await prisma.auditLog.count({ where: { entityId: internalId, event: 'referral.print', action: 'PRINT' } }),
		).toBe(1);
	});
});
