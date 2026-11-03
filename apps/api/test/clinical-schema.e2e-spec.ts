import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createTestUser, resetDatabase, useTestDatabase } from './test-app.js';

/**
 * The clinical schema (DESIGN.md §7, migration 0005_clinical) on Postgres: the happy path of §4.1 as rows, from the
 * order to a closed case with evidence, and the append-only history. The clinical modules arrive with their own
 * repositories and tests; this only checks that the tables, enums, relations and triggers hold together.
 */
describe('clinical schema (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let doctorId = '';

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		app = await createTestApp();
		prisma = app.get(PrismaService);
		({ userId: doctorId } = await createTestUser(app, {
			name: 'Dr. Reyes',
			email: 'reyes@example.com',
			password: 'Sup3r-secret!',
		}));
	});

	afterAll(async () => {
		await app?.close();
	});

	it('follows a result from the order to a closed case', async () => {
		const clinic = await prisma.organization.create({
			data: { name: 'Tagbilaran Health Center', slug: 'tagbilaran-hc', type: 'clinic' },
		});
		const lab = await prisma.organization.create({
			data: { name: 'Bohol Diagnostics', slug: 'bohol-diagnostics', type: 'lab' },
		});
		const patient = await prisma.patient.create({
			data: {
				givenName: 'Maria',
				familyName: 'Santos',
				birthDate: new Date('1981-04-12'),
				sex: 'female',
				preferredLanguage: 'ceb',
				identifiers: { create: { orgId: clinic.id, system: 'MRN', value: 'THC-0001' } },
				careRelationships: { create: { userId: doctorId, orgId: clinic.id, reason: 'encounter' } },
			},
		});
		const encounter = await prisma.encounter.create({
			data: { patientId: patient.id, doctorId, orgId: clinic.id, reason: 'Fatigue, frequent urination' },
		});
		const order = await prisma.clinicalOrder.create({
			data: {
				encounterId: encounter.id,
				patientId: patient.id,
				orderingDoctorId: doctorId,
				orderingOrgId: clinic.id,
				targetOrgId: lab.id,
				code: '4548-4',
				display: 'Hemoglobin A1c',
				status: 'sent',
			},
		});
		const result = await prisma.result.create({
			data: {
				orderId: order.id,
				patientId: patient.id,
				sourceOrgId: lab.id,
				code: '4548-4',
				value: '7.2',
				valueNumeric: 7.2,
				unit: '%',
				refRange: '4.0-5.6',
				flag: 'high',
				resultedAt: new Date(),
			},
		});
		const pathway = await prisma.pathway.create({
			data: { key: 'diabetes', name: 'Diabetes', rules: {}, steps: [], slas: {}, closureRequirements: {} },
		});
		const careCase = await prisma.careCase.create({
			data: {
				patientId: patient.id,
				pathwayId: pathway.id,
				triggerResultId: result.id,
				urgency: 'soon',
				ownerUserId: doctorId,
				ownerOrgId: clinic.id,
				events: { create: { type: 'case.opened', toState: 'open', actorType: 'system' } },
			},
		});
		await prisma.evidence.create({
			data: { caseId: careCase.id, type: 'dispense', recordedByOrgId: clinic.id, note: 'Metformin dispensed' },
		});
		await prisma.careCase.update({ where: { id: careCase.id }, data: { state: 'closed', closedAt: new Date() } });

		const closed = await prisma.careCase.findUniqueOrThrow({
			where: { id: careCase.id },
			include: { events: true, evidence: true, triggerResult: { include: { order: true } } },
		});
		expect(closed.state).toBe('closed');
		expect(closed.events.map((event) => event.toState)).toEqual(['open']);
		expect(closed.evidence.map((evidence) => evidence.type)).toEqual(['dispense']);
		expect(closed.triggerResult?.order?.targetOrgId).toBe(lab.id);
	});

	it('refuses a second identifier with the same system and value in a facility', async () => {
		const [identifier] = await prisma.patientIdentifier.findMany({ take: 1 });

		await expect(
			prisma.patientIdentifier.create({
				data: {
					patientId: identifier.patientId,
					orgId: identifier.orgId,
					system: identifier.system,
					value: identifier.value,
				},
			}),
		).rejects.toThrow();
	});

	it('keeps case events and the audit log append-only', async () => {
		const [event] = await prisma.caseEvent.findMany({ take: 1 });
		const audit = await prisma.auditLog.create({
			data: { userId: doctorId, action: 'view', resource: 'patient', patientId: event.caseId },
		});

		await expect(prisma.caseEvent.update({ where: { id: event.id }, data: { type: 'edited' } })).rejects.toThrow(
			/append-only/,
		);
		await expect(prisma.caseEvent.delete({ where: { id: event.id } })).rejects.toThrow(/append-only/);
		await expect(prisma.auditLog.delete({ where: { id: audit.id } })).rejects.toThrow(/append-only/);
	});
});
