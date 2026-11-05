import { Injectable } from '@nestjs/common';

import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { DiagnosticTestRepository } from './diagnostic-test.repository.js';
import { type DiagnosticTest, toDiagnosticTest } from './models/diagnostic-test.model.js';

/**
 * The organization's test catalog (CBC, FBS, lipid profile, urinalysis, chest X-ray PA …), each with its analytes and
 * sex-specific reference ranges. Read by anyone who works at one of the organization's clinics (row-level security on
 * `diagnostic_tests`); the order form and the lab worklist build on it.
 */
@Injectable()
export class DiagnosticTestService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly tests: DiagnosticTestRepository,
	) {}

	/** The organization's active tests (all of them with `includeInactive`), by category then name. */
	async listForOrganization(
		userId: string,
		organizationId: string,
		opts: { includeInactive?: boolean } = {},
	): Promise<DiagnosticTest[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.tests.listForOrganization(tx, organizationId, opts)).map(toDiagnosticTest),
		);
	}
}
