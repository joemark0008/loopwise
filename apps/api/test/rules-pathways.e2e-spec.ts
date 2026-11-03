import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { seedPathways } from '../prisma/seed-pathways.js';
import { type ClinicalEvents, ClinicalEventsService } from '../src/clinical/events/clinical-events.service.js';
import { RulesService } from '../src/clinical/pathways/rules.service.js';
import { FacilityKeyService } from '../src/facility-keys/facility-key.service.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { sampleOru } from '../src/hl7/oru-samples.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

const EVALUATION = `query ($resultId: ID!) {
	resultEvaluation(resultId: $resultId) {
		resultId pathwayKey pathwayName ruleVersion classification urgency reason guideline nextState slaHours basis
		rule { code band comparedValue comparedUnit received }
	}
}`;

const PATHWAYS = `{
	pathways {
		key version source resultReviewHours criticalAlertHours criticalFlagNextState closureEvidence
		steps { state slaHours }
		triggers { code type unit conversions { from factor } bands { label classification urgency nextState slaHours } }
	}
}`;

/**
 * The rules engine end to end (DESIGN.md §6.2, §6.3 step 3): a stored result is evaluated against the seeded pathways,
 * the evaluation is stored once per rule version, and it is readable exactly by the users who can read the result —
 * the patient's doctor and the lab that sent it, not a doctor at another facility.
 */
describe('rules engine and pathways (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let rules: RulesService;
	let patientId = '';
	let labId = '';
	let labKey = '';
	const evaluated: ClinicalEvents['result.evaluated'][] = [];
	const users = {
		reyes: { cookie: [] as string[], id: '' },
		cruz: { cookie: [] as string[], id: '' },
		lab: { cookie: [] as string[], id: '' },
	};

	const graphql = (cookie: string[], query: string, variables: Record<string, unknown> = {}) =>
		request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });

	const createResult = (data: Partial<Prisma.ResultUncheckedCreateInput> & { code: string; value: string }) =>
		prisma.result.create({
			data: {
				patientId,
				sourceOrgId: labId,
				resultedAt: new Date(),
				valueNumeric: Number.isFinite(Number(data.value)) ? Number(data.value) : null,
				...data,
			},
		});

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		rules = app.get(RulesService);
		await seedPathways(prisma as unknown as Prisma.TransactionClient);
		app.get(ClinicalEventsService).on('result.evaluated', (event) => {
			evaluated.push(event);
		});

		const password = 'Sup3r-secret!';
		for (const [key, name] of [
			['reyes', 'Dr. Reyes'],
			['cruz', 'Dr. Cruz'],
			['lab', 'Lab Tech'],
		] as const) {
			const user = await createTestUser(app, { name, email: `${key}@example.com`, password });
			users[key] = { cookie: user.cookie, id: user.userId };
		}

		const [healthCenter, hospital, lab] = await Promise.all(
			(
				[
					['Health Center', 'hc', 'clinic'],
					['Regional Hospital', 'rh', 'hospital'],
					['Diagnostics Lab', 'lab', 'lab'],
				] as const
			).map(([name, slug, type]) => prisma.organization.create({ data: { name, slug, type } })),
		);
		labId = lab.id;
		await prisma.orgMember.createMany({
			data: [
				{ orgId: healthCenter.id, userId: users.reyes.id, role: 'user' },
				{ orgId: hospital.id, userId: users.cruz.id, role: 'user' },
				{ orgId: lab.id, userId: users.lab.id, role: 'user' },
			],
		});
		const patient = await prisma.patient.create({
			data: {
				givenName: 'Maria',
				familyName: 'Santos',
				birthDate: new Date('1981-04-12'),
				sex: 'female',
				consentAt: new Date(),
				identifiers: {
					create: [
						{ orgId: healthCenter.id, system: 'MRN', value: 'THC-0001' },
						{ orgId: healthCenter.id, system: 'PhilHealth', value: 'SYN-0000-0001' },
					],
				},
				careRelationships: { create: { userId: users.reyes.id, orgId: healthCenter.id, reason: 'encounter' } },
			},
		});
		patientId = patient.id;
		labKey = (await app.get(FacilityKeyService).create(lab.id, users.lab.id, 'LIS')).key;
	});

	afterAll(async () => {
		await app?.close();
	});

	it('lists the pathways with their bands, steps and SLAs', async () => {
		const res = await graphql(users.reyes.cookie, PATHWAYS);
		expect(res.body.errors).toBeUndefined();
		const pathways = res.body.data.pathways;
		expect(pathways.map((p: { key: string }) => p.key)).toEqual(['breast', 'diabetes', 'potassium']);
		const diabetes = pathways.find((p: { key: string }) => p.key === 'diabetes');
		expect(diabetes).toMatchObject({ version: 2, criticalAlertHours: 1, criticalFlagNextState: 'escalated' });
		expect(diabetes.steps.map((s: { state: string }) => s.state)).toContain('confirming');
		expect(diabetes.triggers[0]).toMatchObject({
			code: '4548-4',
			type: 'numeric',
			unit: '%',
			conversions: [{ from: ['mmol/mol'], factor: 0.09148 }],
		});
		expect(diabetes.triggers[0].bands.at(-1)).toEqual({
			label: '≥ 12 %',
			classification: 'critical',
			urgency: 'critical',
			nextState: 'escalated',
			slaHours: 1,
		});
		const breast = pathways.find((p: { key: string }) => p.key === 'breast');
		expect(breast.triggers[0].bands.map((b: { label: string }) => b.label)).toContain('BI-RADS 4');
	});

	it('evaluates every result the HL7 ingest stores (result.received) and publishes result.evaluated', async () => {
		const ack = await request(app.getHttpServer())
			.post('/api/hl7/messages')
			.set('Authorization', `Bearer ${labKey}`)
			.set('Content-Type', 'text/plain')
			.send(sampleOru({ controlId: 'RULES-0001', value: '12.4', flag: 'HH' }));
		expect(ack.status).toBe(200);
		expect(ack.text).toContain('MSA|AA|RULES-0001');

		const result = await prisma.result.findFirstOrThrow({ where: { patientId, value: '12.4' } });
		const stored = await prisma.resultEvaluation.findMany({ where: { resultId: result.id } });
		expect(stored).toMatchObject([
			{
				pathwayKey: 'diabetes',
				ruleVersion: 2,
				classification: 'critical',
				urgency: 'critical',
				nextState: 'escalated',
			},
		]);
		expect(evaluated).toContainEqual(
			expect.objectContaining({
				resultId: result.id,
				patientId,
				evaluationId: stored[0].id,
				classification: 'critical',
			}),
		);
	});

	it('evaluates a stored result without saving, and stores it once per rule version', async () => {
		const result = await createResult({ code: '4548-4', value: '12.1', unit: '%', flag: 'critical_high' });

		expect(await rules.evaluateResult(result.id)).toMatchObject({ classification: 'critical', basis: 'band' });
		expect(await prisma.resultEvaluation.count({ where: { resultId: result.id } })).toBe(0);

		const first = await rules.evaluateAndStore(result.id);
		const again = await rules.evaluateAndStore(result.id);
		expect(first).toMatchObject({ resultId: result.id, patientId, evaluation: { urgency: 'critical' } });
		expect(again?.evaluationId).toBe(first?.evaluationId);
		expect(await prisma.resultEvaluation.count({ where: { resultId: result.id } })).toBe(1);
		// Published once: a repeat stores nothing new and tells no one.
		expect(evaluated.filter((event) => event.resultId === result.id)).toHaveLength(1);
	});

	it('lets the patient’s doctor read why, audited', async () => {
		const result = await createResult({ code: '4548-4', value: '48', unit: 'mmol/mol', flag: 'high' });
		await rules.evaluateAndStore(result.id);

		const res = await graphql(users.reyes.cookie, EVALUATION, { resultId: result.id });
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.resultEvaluation).toMatchObject({
			resultId: result.id,
			pathwayKey: 'diabetes',
			pathwayName: 'Diabetes (HbA1c / fasting glucose)',
			ruleVersion: 2,
			classification: 'actionable',
			urgency: 'soon',
			nextState: 'confirming',
			slaHours: 336,
			basis: 'band',
			reason: expect.stringContaining('(48 mmol/mol = 6.54304 %)'),
			rule: { code: '4548-4', band: '6.5 – < 10 %', comparedUnit: '%', received: '48 mmol/mol' },
		});
		const audit = await prisma.auditLog.findMany({
			where: { userId: users.reyes.id, action: 'result_evaluation.view', patientId },
		});
		expect(audit.length).toBeGreaterThan(0);
	});

	it('lets the lab that sent the result read it too', async () => {
		const result = await createResult({ code: '24606-6', value: 'BI-RADS 4', flag: 'abnormal' });
		await rules.evaluateAndStore(result.id);
		const res = await graphql(users.lab.cookie, EVALUATION, { resultId: result.id });
		expect(res.body.data.resultEvaluation).toMatchObject({ pathwayKey: 'breast', nextState: 'referred' });
	});

	it('hides it from a doctor at another facility (row-level security), and audits nothing', async () => {
		const result = await createResult({ code: '2823-3', value: '6.5', unit: 'mmol/L', flag: 'critical_high' });
		await rules.evaluateAndStore(result.id);

		const res = await graphql(users.cruz.cookie, EVALUATION, { resultId: result.id });
		expect(res.body.errors).toBeUndefined();
		expect(res.body.data.resultEvaluation).toBeNull();
		expect(await prisma.auditLog.count({ where: { userId: users.cruz.id } })).toBe(0);

		// The row is there; only the policy keeps it from Dr. Cruz.
		const own = await graphql(users.reyes.cookie, EVALUATION, { resultId: result.id });
		expect(own.body.data.resultEvaluation).toMatchObject({ pathwayKey: 'potassium', classification: 'critical' });
	});

	it('stores nothing for a result no pathway covers', async () => {
		const result = await createResult({ code: '2160-0', value: '1.1', unit: 'mg/dL' });
		expect(await rules.evaluateAndStore(result.id)).toBeNull();
		expect(await prisma.resultEvaluation.count({ where: { resultId: result.id } })).toBe(0);
		const res = await graphql(users.reyes.cookie, EVALUATION, { resultId: result.id });
		expect(res.body.data.resultEvaluation).toBeNull();
	});

	it('keeps evaluations append-only', async () => {
		const result = await createResult({ code: '1558-6', value: '130', unit: 'mg/dL' });
		const stored = await rules.evaluateAndStore(result.id);
		await expect(
			prisma.resultEvaluation.update({ where: { id: stored!.evaluationId }, data: { reason: 'changed' } }),
		).rejects.toThrow();
		await expect(prisma.resultEvaluation.delete({ where: { id: stored!.evaluationId } })).rejects.toThrow();
	});
});
