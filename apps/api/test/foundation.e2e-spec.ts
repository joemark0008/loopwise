import { ICD10_CODES } from '@loopwise/shared/icd10';
import { Controller, Get, Headers, Module, Param } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditModule } from '../src/clinical/audit/audit.module.js';
import { AuditService } from '../src/clinical/audit/audit.service.js';
import { ClinicalDbModule } from '../src/clinical/rls/clinical-db.module.js';
import { ClinicalDbService } from '../src/clinical/rls/clinical-db.service.js';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter.js';
import { EntityNotFoundError } from '../src/common/errors/domain-error.js';
import { mapError } from '../src/common/errors/error-mapping.js';
import { AccessRepository } from '../src/common/guards/access.repository.js';
import { AccessService } from '../src/common/guards/access.service.js';
import { REQUEST_ID_HEADER, requestContextMiddleware } from '../src/common/request-context.js';
import { ConfigModule } from '../src/config/config.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { type ClinicScene, createClinicScene, createUser } from './fixtures/clinic-fixtures.js';
import { resetDatabase, useTestDatabase } from './test-db.js';

/** A stand-in for a clinical resolver: opens an encounter as the user and audits the view. */
@Controller('probe')
class ProbeController {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly audit: AuditService,
	) {}

	@Get('encounters/:id')
	view(@Param('id') id: string, @Headers('x-test-user') userId: string) {
		return this.db.asUser(userId, async (tx) => {
			const encounter = await tx.encounter.findUnique({ where: { id }, include: { vitals: true } });
			if (!encounter) {
				throw new EntityNotFoundError('Encounter', id);
			}
			await this.audit.view(tx, {
				event: 'encounter.view',
				entityType: 'Encounter',
				entityId: encounter.id,
				userId,
				patientId: encounter.patientId,
				clinicId: encounter.clinicId,
			});
			return { id: encounter.id, vitals: encounter.vitals.length };
		});
	}
}

@Module({
	imports: [ConfigModule, PrismaModule, ClinicalDbModule, AuditModule],
	controllers: [ProbeController],
	providers: [AccessRepository, AccessService, { provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
class FoundationTestModule {}

/**
 * The shared foundation: fixtures, row-level security through `ClinicalDbService`, the audit trail with the request
 * context, the access levels from `user_clinic_roles` + `organization_members`, and the reference seed.
 */
describe('foundation (e2e)', () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;
	let db: ClinicalDbService;
	let scene: ClinicScene;

	beforeAll(async () => {
		await resetDatabase(useTestDatabase());
		const moduleRef = await Test.createTestingModule({ imports: [FoundationTestModule] }).compile();
		app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
		app.use(requestContextMiddleware);
		app.use(express.json());
		app.use(requestContextMiddleware);
		await app.init();
		prisma = app.get(PrismaService);
		db = app.get(ClinicalDbService);

		scene = await createClinicScene(prisma);
		await prisma.vitalSigns.create({
			data: { encounterId: scene.encounter.id, systolicBp: 128, diastolicBp: 82, recordedById: scene.doctor.id },
		});
	});

	afterAll(async () => {
		await app?.close();
	});

	describe('row-level security', () => {
		it('lets a doctor with a care relationship see the patient, the encounter and its vitals', async () => {
			const seen = await db.asUser(scene.doctor.id, async (tx) => ({
				patients: await tx.patient.findMany({ select: { id: true } }),
				encounters: await tx.encounter.findMany({ select: { id: true } }),
				vitals: await tx.vitalSigns.findMany({ where: { encounter: { patientId: scene.patient.id } } }),
			}));
			expect(seen.patients).toEqual([{ id: scene.patient.id }]);
			expect(seen.encounters).toEqual([{ id: scene.encounter.id }]);
			expect(seen.vitals).toHaveLength(1);
		});

		it('hides them from a doctor of the same clinic without one', async () => {
			const seen = await db.asUser(scene.otherDoctor.id, async (tx) => ({
				patients: await tx.patient.count(),
				encounters: await tx.encounter.count(),
				vitals: await tx.vitalSigns.count(),
			}));
			expect(seen).toEqual({ patients: 0, encounters: 0, vitals: 0 });
		});

		it('refuses their writes with SQLSTATE 42501, mapped to FORBIDDEN', async () => {
			const error = await db
				.asUser(scene.otherDoctor.id, (tx) =>
					tx.vitalSigns.create({ data: { encounterId: scene.encounter.id, heartRate: 80 } }),
				)
				.catch((e: unknown) => e);
			expect(mapError(error)).toMatchObject({ code: 'FORBIDDEN', errorCode: 'ROW_SECURITY_DENIED' });
		});

		it('rejects a malformed user id before reaching the database', async () => {
			await expect(db.asUser('hc', async () => 1)).rejects.toMatchObject({ codeMessage: 'UNAUTHORIZED' });
		});
	});

	describe('audit trail', () => {
		it('records the view with the caller’s request id, ip and user agent, and echoes the id', async () => {
			const res = await request(app.getHttpServer())
				.get(`/probe/encounters/${scene.encounter.id}`)
				.set('x-test-user', scene.doctor.id)
				.set(REQUEST_ID_HEADER, 'req-foundation-1')
				.set('User-Agent', 'foundation-test')
				.expect(200);
			expect(res.body).toEqual({ id: scene.encounter.id, vitals: 1 });
			expect(res.headers[REQUEST_ID_HEADER]).toBe('req-foundation-1');

			const row = await prisma.auditLog.findFirstOrThrow({ where: { requestId: 'req-foundation-1' } });
			expect(row).toMatchObject({
				action: 'VIEW',
				event: 'encounter.view',
				entityType: 'Encounter',
				entityId: scene.encounter.id,
				userId: scene.doctor.id,
				patientId: scene.patient.id,
				clinicId: scene.clinic.id,
				userAgent: 'foundation-test',
			});
			expect(row.ipAddress).toBeTruthy();
		});

		it('generates a request id when the caller sends none', async () => {
			const res = await request(app.getHttpServer())
				.get(`/probe/encounters/${scene.encounter.id}`)
				.set('x-test-user', scene.admin.id)
				.expect(200);
			const requestId = res.headers[REQUEST_ID_HEADER] as string;
			expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
			expect(await prisma.auditLog.count({ where: { requestId, userId: scene.admin.id } })).toBe(1);
		});

		it('answers NOT_FOUND with the stable code and request id, and writes nothing, when RLS hides it', async () => {
			const res = await request(app.getHttpServer())
				.get(`/probe/encounters/${scene.encounter.id}`)
				.set('x-test-user', scene.otherDoctor.id)
				.set(REQUEST_ID_HEADER, 'req-foundation-denied')
				.expect(404);
			expect(res.body).toEqual({
				error: 'Encounter not found.',
				code: 'NOT_FOUND',
				errorCode: 'ENTITY_NOT_FOUND',
				details: { entityType: 'Encounter', id: scene.encounter.id },
				requestId: 'req-foundation-denied',
			});
			expect(await prisma.auditLog.count({ where: { requestId: 'req-foundation-denied' } })).toBe(0);
		});

		it('refuses a row in another user’s name inside their transaction (audit_logs_own)', async () => {
			const audit = app.get(AuditService);
			const error = await db
				.asUser(scene.doctor.id, (tx) =>
					audit.record(tx, {
						action: 'VIEW',
						event: 'patient.view',
						entityType: 'Patient',
						userId: scene.admin.id,
					}),
				)
				.catch((e: unknown) => e);
			expect(mapError(error)).toMatchObject({ code: 'FORBIDDEN' });
		});

		it('records system work outside a request', async () => {
			const audit = app.get(AuditService);
			const row = await audit.recordOutsideTransaction({
				action: 'CREATE',
				event: 'job.test',
				entityType: 'Patient',
				entityId: scene.patient.id,
				userId: null,
				origin: { via: 'job', name: 'foundation-test' },
				changes: { after: { status: 'ok' } },
			});
			expect(row).toMatchObject({ userId: null, requestId: null, origin: { via: 'job' } });
		});
	});

	describe('access levels', () => {
		it('derives the clinic access level from clinic and organization roles', async () => {
			const access = app.get(AccessService);
			expect(await access.getUserRoleInClinic(scene.clinic.id, scene.admin.id)).toBe('admin');
			expect(await access.getUserRoleInClinic(scene.clinic.id, scene.doctor.id)).toBe('user');
			const outsider = await createUser(prisma);
			expect(await access.getUserRoleInClinic(scene.clinic.id, outsider.id)).toBeNull();
			await expect(access.resolveClinicAccess(outsider.id, scene.clinic.id)).rejects.toMatchObject({
				codeMessage: 'BAD_REQUEST',
			});

			const grant = await access.resolveClinicAccess(scene.doctor.id, scene.clinic.id, ['admin', 'user']);
			expect(grant).toMatchObject({ clinic: { id: scene.clinic.id }, userRole: 'user', staffRoles: ['DOCTOR'] });
		});

		it('resolves organization membership from members and clinic roles', async () => {
			const access = app.get(AccessService);
			expect(await access.resolveOrganizationMembership(scene.admin.id, null)).toMatchObject({
				organization: { id: scene.organization.id },
				role: 'ADMIN',
			});
			expect(await access.resolveOrganizationMembership(scene.doctor.id, scene.clinic.id)).toMatchObject({
				organization: { id: scene.organization.id },
				role: 'MEMBER',
			});
			// A clinic id the database doesn't have (remembered from another database) falls back to the membership.
			const staleClinicId = '01933b2a-0000-7000-8000-00000000dead';
			expect(await access.resolveOrganizationMembership(scene.admin.id, staleClinicId)).toMatchObject({
				organization: { id: scene.organization.id },
				role: 'ADMIN',
			});
			const outsider = await createUser(prisma);
			await expect(access.resolveOrganizationMembership(outsider.id, null)).rejects.toMatchObject({
				codeMessage: 'NOT_FOUND',
			});
			await expect(access.resolveOrganizationMembership(outsider.id, staleClinicId)).rejects.toMatchObject({
				codeMessage: 'NOT_FOUND',
			});
		});
	});

	it('has the reference data and keeps it across resets', async () => {
		expect(await prisma.icd10Code.count()).toBe(ICD10_CODES.length);
		expect(await prisma.barangay.count({ where: { cityMunicipalityCode: '0701242000' } })).toBe(15);
		expect(await prisma.rvsCode.count()).toBeGreaterThan(0);
	});
});
