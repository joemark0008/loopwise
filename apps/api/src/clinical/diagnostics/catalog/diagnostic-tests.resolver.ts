import { Args, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser } from '../../../common/decorators/current.decorator.js';
import type { Clinic } from '../../../generated/prisma/client.js';
import { DiagnosticTestService } from './diagnostic-test.service.js';
import { DiagnosticTest } from './models/diagnostic-test.model.js';

/** The test catalog of the selected clinic's organization. */
@Resolver(() => DiagnosticTest)
export class DiagnosticTestsResolver {
	constructor(private readonly tests: DiagnosticTestService) {}

	@ClinicAccess()
	@Query(() => [DiagnosticTest], {
		description: "The tests the clinic's organization offers (its catalog), each with its analytes and ranges.",
	})
	diagnosticTests(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Args('includeInactive', { type: () => Boolean, nullable: true }) includeInactive?: boolean | null,
	): Promise<DiagnosticTest[]> {
		return this.tests.listForOrganization(user.id, clinic.organizationId, { includeInactive: !!includeInactive });
	}
}
