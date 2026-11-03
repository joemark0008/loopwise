import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FacilityKeyService } from '../src/facility-keys/facility-key.service.js';
import { sampleOru, sampleRadiologyOru } from '../src/hl7/oru-samples.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const FIELDS = `id code display value unit refRange flag urgency reviewedAt orderId orderStatus
	patient { id givenName } sourceFacility { name }`;
const TO_REVIEW = `query { resultsToReview { ${FIELDS} } }`;
const PATIENT_RESULTS = `query ($patientId: ID!) { patientResults(patientId: $patientId) { ${FIELDS} } }`;
const REVIEW = `mutation ($input: ReviewResultInput!) { reviewResult(input: $input) { ${FIELDS} } }`;

/** The results inbox (DESIGN.md §4.1 steps 5–6): what each clinician must review, critical first, and the review. */
describe('results inbox (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let labKey = '';
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		santos: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
		lab: { cookie: [] as string[], id: '' },
	};
	const ids = { clinic: '', lab: '', maria: '', order: '', fbsOrder: '' };

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });
	const post = (body: string) =>
		request(app.getHttpServer())
			.post('/api/hl7/messages')
			.set('Authorization', `Bearer ${labKey}`)
			.set('Content-Type', 'text/plain')
			.send(body)
			.expect(200);
	const inbox = async (cookie: string[]) => {
		const res = await graphql(cookie, TO_REVIEW);
		expect(res.body.errors).toBeUndefined();
		return res.body.data.resultsToReview as { id: string; code: string; urgency: string; flag: string | null }[];
	};

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		const password = 'Sup3r-secret!';
		for (const key of Object.keys(users) as (keyof typeof users)[]) {
			const user = await createTestUser(app, { name: key, email: `${key}@example.com`, password });
			users[key] = { cookie: user.cookie, id: user.userId };
		}
		const org = (name: string, slug: string, type: 'clinic' | 'lab') =>
			prisma.organization.create({ data: { name, slug, type } }).then((row) => row.id);
		ids.clinic = await org('Health Center', 'hc', 'clinic');
		ids.lab = await org('Diagnostics Lab', 'lab', 'lab');
		const otherClinic = await org('Other Clinic', 'oc', 'clinic');
		await prisma.orgMember.createMany({
			data: [
				{ orgId: ids.clinic, userId: users.reyes.id, role: 'user' },
				{ orgId: ids.clinic, userId: users.santos.id, role: 'user' },
				{ orgId: otherClinic, userId: users.cruz.id, role: 'user' },
				{ orgId: ids.lab, userId: users.lab.id, role: 'user' },
			],
		});
		ids.maria = (
			await prisma.patient.create({
				data: {
					givenName: 'Maria',
					familyName: 'Santos',
					birthDate: new Date('1981-04-12'),
					sex: 'female',
					identifiers: {
						create: [
							{ orgId: ids.clinic, system: 'MRN', value: 'THC-0001' },
							{ orgId: ids.clinic, system: 'PhilHealth', value: 'SYN-0000-0001' },
						],
					},
					careRelationships: {
						create: [
							{ userId: users.reyes.id, orgId: ids.clinic, reason: 'encounter' },
							{ userId: users.santos.id, orgId: ids.clinic, reason: 'encounter' },
						],
					},
				},
			})
		).id;
		const order = (code: string, display: string) =>
			prisma.clinicalOrder
				.create({
					data: {
						patientId: ids.maria,
						orderingDoctorId: users.reyes.id,
						orderingOrgId: ids.clinic,
						targetOrgId: ids.lab,
						code,
						display,
						status: 'sent',
						sentAt: new Date(),
					},
				})
				.then((row) => row.id);
		ids.order = await order('4548-4', 'Hemoglobin A1c');
		ids.fbsOrder = await order('1558-6', 'Fasting glucose');
		labKey = (await app.get(FacilityKeyService).create(ids.lab, users.lab.id, 'LIS')).key;

		// Normal first, then abnormal, then critical: the inbox must reverse that.
		await post(
			sampleOru({ controlId: 'FBS-1', placerOrderNumber: ids.fbsOrder, value: '92', flag: 'N' }).replace(
				/4548-4\^Hemoglobin A1c[^|^]*\^LN/g,
				'1558-6^Fasting glucose^LN',
			),
		);
		await post(sampleOru({ controlId: 'A1C-1', placerOrderNumber: ids.order }));
		await post(sampleOru({ controlId: 'A1C-CRIT', value: '12.4', flag: 'HH' }));
		await post(sampleRadiologyOru('RIS-1'));
	});

	afterAll(async () => {
		await app?.close();
	});

	it("lists the ordering doctor's results critical first, then abnormal, reports, normal", async () => {
		const results = await inbox(users.reyes.cookie);
		expect(results.map((result) => [result.urgency, result.code])).toEqual([
			['critical', '4548-4'],
			['abnormal', '4548-4'],
			['unflagged', '36643-5'],
			['normal', '1558-6'],
		]);
	});

	it('shows unordered results to the clinicians who can see the patient, never to the lab that sent them', async () => {
		// Santos ordered nothing: only the results with no order (critical HbA1c, X-ray).
		expect((await inbox(users.santos.cookie)).map((result) => result.urgency)).toEqual(['critical', 'unflagged']);
		expect(await inbox(users.lab.cookie)).toEqual([]);
	});

	it("keeps the results from another facility's doctor", async () => {
		expect(await inbox(users.cruz.cookie)).toEqual([]);
		const res = await graphql(users.cruz.cookie, PATIENT_RESULTS, { patientId: ids.maria });
		expect(res.body.data.patientResults).toEqual([]);
		const result = await prisma.result.findFirstOrThrow({ where: { orderId: ids.order } });
		const review = await graphql(users.cruz.cookie, REVIEW, { input: { resultId: result.id } });
		expect(review.body.errors?.[0].extensions.code).toBe('NOT_FOUND');
	});

	it('reviews a result with an audited note and moves the order to reviewed', async () => {
		const result = await prisma.result.findFirstOrThrow({ where: { orderId: ids.order } });
		const notOrderer = await graphql(users.santos.cookie, REVIEW, { input: { resultId: result.id } });
		expect(notOrderer.body.errors?.[0].extensions.code).toBe('FORBIDDEN');

		const res = await graphql(users.reyes.cookie, REVIEW, {
			input: { resultId: result.id, note: '  Diabetes range; discuss at follow-up  ' },
		});
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.reviewResult).toMatchObject({ id: result.id, orderStatus: 'reviewed' });
		expect(res.body.data.reviewResult.reviewedAt).not.toBeNull();

		const stored = await prisma.result.findUniqueOrThrow({ where: { id: result.id } });
		expect(stored.reviewedById).toBe(users.reyes.id);
		expect((await prisma.clinicalOrder.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe('reviewed');
		expect(await prisma.auditLog.findMany({ where: { action: 'result.review' } })).toEqual([
			expect.objectContaining({
				userId: users.reyes.id,
				orgId: ids.clinic,
				patientId: ids.maria,
				resource: 'result',
				resourceId: result.id,
				reason: 'Diabetes range; discuss at follow-up',
			}),
		]);

		const again = await graphql(users.reyes.cookie, REVIEW, { input: { resultId: result.id } });
		expect(again.body.errors?.[0].extensions.code).toBe('CONFLICT');
		expect((await inbox(users.reyes.cookie)).map((row) => row.id)).not.toContain(result.id);
	});

	it("lists the patient's results, reviewed or not, for the chart's Results tab", async () => {
		const res = await graphql(users.reyes.cookie, PATIENT_RESULTS, { patientId: ids.maria });
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.patientResults).toHaveLength(4);
		expect(
			res.body.data.patientResults.filter((row: { reviewedAt: string | null }) => row.reviewedAt),
		).toHaveLength(1);
		expect(await prisma.auditLog.count({ where: { action: 'result.list', userId: users.reyes.id } })).toBe(1);
	});
});
