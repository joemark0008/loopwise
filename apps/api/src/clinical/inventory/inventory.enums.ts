import { registerEnumType } from '@nestjs/graphql';

import { ItemCategory, StockMovementType } from '../../generated/prisma/enums.js';

/** The inventory domain's enums, as the schema names them (`inventory.prisma`), registered once for GraphQL. */
registerEnumType(ItemCategory, { name: 'ItemCategory' });
registerEnumType(StockMovementType, {
	name: 'StockMovementType',
	description:
		'RECEIPT, DISPENSE, CONSUMPTION, ADJUSTMENT_IN / ADJUSTMENT_OUT, EXPIRED_DISPOSAL, DAMAGED (and the transfer and return types of the reference).',
});

/** Which way a manual adjustment moves stock. */
export enum AdjustmentDirection {
	IN = 'IN',
	OUT = 'OUT',
}
registerEnumType(AdjustmentDirection, { name: 'StockAdjustmentDirection' });

/** The kinds of stock alert of the pharmacy dashboard. */
export enum InventoryAlertKind {
	LOW_STOCK = 'LOW_STOCK',
	EXPIRING = 'EXPIRING',
	EXPIRED = 'EXPIRED',
}
registerEnumType(InventoryAlertKind, { name: 'InventoryAlertKind' });

export { ItemCategory, StockMovementType };
