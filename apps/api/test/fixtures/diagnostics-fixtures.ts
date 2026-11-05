/**
 * Diagnostics test fixtures: a small catalog (HbA1c, CBC with sex-specific ranges, chest X-ray PA) for an organization,
 * and a Nest testing module with just the diagnostics module and what it needs, so the diagnostics e2e specs run
 * the services against the real database (row-level security, triggers, audit) without the whole AppModule.
 * Synthetic data only.
 */
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { AuthModule } from '../../src/auth/auth.module.js';
import { DiagnosticsModule } from '../../src/clinical/diagnostics/diagnostics.module.js';
import { ConfigModule } from '../../src/config/config.module.js';
import type { DiagnosticTestParameter } from '../../src/generated/prisma/client.js';
import { PrismaModule } from '../../src/prisma/prisma.module.js';
import type { FixtureDb } from './clinic-fixtures.js';

/** AuthModule: the global `AuthGuard` GuardsModule registers needs `AuthService`. */
@Module({ imports: [ConfigModule, PrismaModule, AuthModule, DiagnosticsModule] })
class DiagnosticsTestModule {}

export function createDiagnosticsTestingModule(): Promise<TestingModule> {
	return Test.createTestingModule({ imports: [DiagnosticsTestModule] }).compile();
}

export interface TestCatalog {
	hba1c: { id: string; parameters: DiagnosticTestParameter[] };
	cbc: { id: string; parameters: DiagnosticTestParameter[] };
	cxr: { id: string; parameters: DiagnosticTestParameter[] };
}

export async function createTestCatalog(db: FixtureDb, organizationId: string): Promise<TestCatalog> {
	const hba1c = await db.diagnosticTest.create({
		data: {
			organizationId,
			code: 'HBA1C',
			name: 'Hemoglobin A1c (HbA1c)',
			category: 'LABORATORY',
			lisCode: '4548-4',
			parameters: {
				create: [
					{
						code: 'HBA1C',
						name: 'HbA1c',
						unit: '%',
						refHighMale: 5.6,
						refHighFemale: 5.6,
						refLowMale: 4,
						refLowFemale: 4,
						lisCode: '4548-4',
					},
				],
			},
		},
		include: { parameters: true },
	});
	const cbc = await db.diagnosticTest.create({
		data: {
			organizationId,
			code: 'CBC',
			name: 'Complete blood count (CBC)',
			category: 'LABORATORY',
			lisCode: '58410-2',
			parameters: {
				create: [
					{
						code: 'HGB',
						name: 'Hemoglobin',
						unit: 'g/dL',
						refLowMale: 13.5,
						refHighMale: 17.5,
						refLowFemale: 12,
						refHighFemale: 15.5,
						lisCode: '718-7',
						sortOrder: 0,
					},
					{
						code: 'WBC',
						name: 'White blood cells',
						unit: '×10⁹/L',
						refLowMale: 4.5,
						refHighMale: 11,
						refLowFemale: 4.5,
						refHighFemale: 11,
						sortOrder: 1,
					},
				],
			},
		},
		include: { parameters: true },
	});
	const cxr = await db.diagnosticTest.create({
		data: { organizationId, code: 'CXR-PA', name: 'Chest X-ray PA', category: 'IMAGING' },
		include: { parameters: true },
	});
	return { hba1c, cbc, cxr };
}
