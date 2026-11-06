import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import { InventoryLotModel } from './stock.model.js';

@ObjectType({ description: 'An item whose unexpired stock is at or below its reorder level.' })
export class LowStockItemModel {
	@Field(() => ID)
	itemId: string;

	@Field()
	sku: string;

	@Field()
	itemName: string;

	@Field()
	unitOfMeasure: string;

	@Field(() => Float)
	usableOnHand: number;

	@Field(() => Float)
	reorderLevel: number;
}

@ObjectType({ description: "The pharmacy dashboard's alerts at the selected clinic." })
export class InventoryAlertsModel {
	@Field({ description: 'YYYY-MM-DD in Manila the alerts are computed for.' })
	asOf: string;

	@Field(() => Int, { description: 'Days ahead a lot counts as expiring.' })
	expiringWithinDays: number;

	@Field(() => [LowStockItemModel])
	lowStock: LowStockItemModel[];

	@Field(() => [InventoryLotModel], { description: 'Lots with stock expiring within the window, soonest first.' })
	expiring: InventoryLotModel[];

	@Field(() => [InventoryLotModel], { description: 'Lots past expiry that still hold stock: dispose of them.' })
	expired: InventoryLotModel[];
}
