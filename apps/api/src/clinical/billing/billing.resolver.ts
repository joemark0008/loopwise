import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { BillingService } from './billing.service.js';
import { MarkBillPaidInput, SaveEncounterBillInput } from './dto/encounter-bill.input.js';
import { EncounterBill } from './models/encounter-bill.model.js';

/** Encounter bills (read through `encounterRecord`). Access is row-level security plus the facility check. */
@Resolver(() => EncounterBill)
export class BillingResolver {
	constructor(private readonly service: BillingService) {}

	@Mutation(() => EncounterBill, { description: "Creates or replaces the encounter's draft bill." })
	saveEncounterBill(
		@CurrentUser() user: AuthUser,
		@Args('input') input: SaveEncounterBillInput,
	): Promise<EncounterBill> {
		return this.service.save(user.id, input);
	}

	@Mutation(() => EncounterBill, { description: 'Locks the bill; it can then only be paid or voided.' })
	finalizeEncounterBill(
		@CurrentUser() user: AuthUser,
		@Args('id', { type: () => ID }) id: string,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<EncounterBill> {
		return this.service.finalize(user.id, id, wiseOrigin);
	}

	@Mutation(() => EncounterBill)
	markEncounterBillPaid(
		@CurrentUser() user: AuthUser,
		@Args('input') input: MarkBillPaidInput,
	): Promise<EncounterBill> {
		return this.service.markPaid(user.id, input);
	}

	@Mutation(() => EncounterBill)
	voidEncounterBill(@CurrentUser() user: AuthUser, @Args('input') input: VoidEntryInput): Promise<EncounterBill> {
		return this.service.void(user.id, input);
	}
}
