import { Args, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type BillingActor, CurrentBillingActor, INVOICE_COLLECT_ROLES } from '../billing-access.js';
import { CashierDeskService } from './cashier-desk.service.js';
import { CashierDesk } from './models/cashier-desk.model.js';

/** The cashier desk of the selected clinic: cashiers, billing clerks and clinic admins. */
@Resolver(() => CashierDesk)
export class CashierDeskResolver {
	constructor(private readonly desk: CashierDeskService) {}

	@Query(() => CashierDesk, { description: "A day's collections, the invoices to settle and the user's shift." })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	cashierDesk(
		@CurrentBillingActor() actor: BillingActor,
		@Args('date', { type: () => String, nullable: true, description: 'YYYY-MM-DD; default today.' })
		date?: string | null,
	): Promise<CashierDesk> {
		return this.desk.desk(actor, date);
	}
}
