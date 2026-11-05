import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { TEST_INCLUDE } from '../diagnostic.includes.js';
import type { DiagnosticTestRow } from './models/diagnostic-test.model.js';

/** The organization's test catalog (`diagnostic_tests` + parameters), read under row-level security. */
@Injectable()
export class DiagnosticTestRepository {
	listForOrganization(
		tx: ClinicalTx,
		organizationId: string,
		opts: { includeInactive?: boolean } = {},
	): Promise<DiagnosticTestRow[]> {
		return tx.diagnosticTest.findMany({
			where: { organizationId, ...(opts.includeInactive ? {} : { isActive: true }) },
			include: TEST_INCLUDE,
			orderBy: [{ category: 'asc' }, { name: 'asc' }],
		});
	}

	/** The active tests of the organization among `ids` (unknown, inactive or another organization's are left out). */
	findActiveByIds(tx: ClinicalTx, organizationId: string, ids: readonly string[]): Promise<DiagnosticTestRow[]> {
		return tx.diagnosticTest.findMany({
			where: { organizationId, isActive: true, id: { in: [...ids] } },
			include: TEST_INCLUDE,
		});
	}
}
