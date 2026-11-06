import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type BillingActor, CurrentBillingActor, INVOICE_COLLECT_ROLES } from '../billing-access.js';
import { CashierShiftService } from './cashier-shift.service.js';
import { CashierShiftsInput, CloseCashierShiftInput, OpenCashierShiftInput } from './dto/cashier-shift.input.js';
import { CashierShift } from './models/cashier-shift.model.js';

/** Cashier shifts at the selected clinic: cashiers, billing clerks and clinic admins (who see every cashier's). */
@Resolver(() => CashierShift)
export class CashierShiftResolver {
	constructor(private readonly shifts: CashierShiftService) {}

	@Query(() => CashierShift, { nullable: true, description: "The user's open shift here, with running totals." })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	myCashierShift(@CurrentBillingActor() actor: BillingActor): Promise<CashierShift | null> {
		return this.shifts.current(actor);
	}

	@Query(() => [CashierShift], { description: "The clinic's shifts of a period, newest first." })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	cashierShifts(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: CashierShiftsInput,
	): Promise<CashierShift[]> {
		return this.shifts.list(actor, input);
	}

	@Mutation(() => CashierShift, { description: 'Opens a shift with the cash float.' })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	openCashierShift(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: OpenCashierShiftInput,
	): Promise<CashierShift> {
		return this.shifts.open(actor, input);
	}

	@Mutation(() => CashierShift, { description: 'X reading: the summary by method; the shift stays open.' })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	cashierShiftXReading(
		@CurrentBillingActor() actor: BillingActor,
		@Args('shiftId', { type: () => ID }) shiftId: string,
	): Promise<CashierShift> {
		return this.shifts.xReading(actor, shiftId);
	}

	@Mutation(() => CashierShift, { description: 'Z reading: counts the cash and closes the shift.' })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	closeCashierShift(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: CloseCashierShiftInput,
	): Promise<CashierShift> {
		return this.shifts.close(actor, input);
	}
}
