import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { INVENTORY_DESKS } from '../inventory-access.js';
import { ReceiveStockInput } from './dto/stock-receipt.input.js';
import { StockReceiptModel } from './models/stock-receipt.model.js';
import { StockReceiptService } from './stock-receipt.service.js';

/** Pharmacy → Receive stock: deliveries into the selected clinic. */
@Resolver(() => StockReceiptModel)
export class StockReceiptsResolver {
	constructor(private readonly receipts: StockReceiptService) {}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => [StockReceiptModel], { description: "The selected clinic's latest deliveries, newest first." })
	stockReceipts(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
	): Promise<StockReceiptModel[]> {
		return this.receipts.list(actor, Math.min(Math.max(limit, 1), 100));
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => StockReceiptModel, {
		description: 'Receives a delivery: creates or adds to each lot and writes RECEIPT movements (audited).',
	})
	receiveStock(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: ReceiveStockInput,
	): Promise<StockReceiptModel> {
		return this.receipts.receive(actor, input);
	}
}
