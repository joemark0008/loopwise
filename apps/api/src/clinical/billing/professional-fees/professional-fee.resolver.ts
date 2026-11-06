import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess, ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type BillingActor, CurrentBillingActor } from '../billing-access.js';
import { ProfessionalFeeReportInput, ReleaseProfessionalFeesInput } from './dto/professional-fee.input.js';
import { ProfessionalFeeReport } from './models/professional-fee.model.js';
import { ProfessionalFeeService } from './professional-fee.service.js';

/**
 * Doctors' professional fees at the selected clinic. The report: the billing desk and admins see every doctor's, a
 * doctor their own (row-level security); releasing a payout: clinic admins.
 */
@Resolver()
export class ProfessionalFeeResolver {
	constructor(private readonly fees: ProfessionalFeeService) {}

	@Query(() => ProfessionalFeeReport, { description: 'Professional fees of a period, by doctor.' })
	@ClinicAccess({ staffRoles: ['CASHIER', 'BILLING_CLERK', 'DOCTOR'] })
	professionalFeeReport(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: ProfessionalFeeReportInput,
	): Promise<ProfessionalFeeReport> {
		return this.fees.report(actor, input);
	}

	@Mutation(() => ProfessionalFeeReport, { description: 'Marks fees paid out, with the payout reference.' })
	@ClinicAdmin()
	releaseProfessionalFees(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: ReleaseProfessionalFeesInput,
	): Promise<ProfessionalFeeReport> {
		return this.fees.release(actor, input);
	}
}
