import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type ClinicActor, CurrentClinicActor } from '../../clinics/clinic-admin-actor.js';
import { INVENTORY_DESKS } from '../inventory-access.js';
import {
	AdjustStockInput,
	DisposeExpiredStockInput,
	RecordConsumptionInput,
	RecordDamagedStockInput,
} from './dto/stock.input.js';
import { InventoryAlertsModel } from './models/inventory-alerts.model.js';
import { InventoryLotModel, StockMovementModel } from './models/stock.model.js';
import { StockAdjustmentService } from './stock-adjustment.service.js';
import { StockQueryService } from './stock-query.service.js';

/** Stock at the selected clinic: lots, the ledger, the alerts, and the explicit stock changes. */
@Resolver(() => StockMovementModel)
export class StockResolver {
	constructor(
		private readonly query: StockQueryService,
		private readonly adjustments: StockAdjustmentService,
	) {}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => [InventoryLotModel], { description: "An item's lots at the selected clinic, earliest expiry first." })
	inventoryLots(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('itemId', { type: () => ID }) itemId: string,
		@Args('includeEmpty', { defaultValue: false }) includeEmpty: boolean,
	): Promise<InventoryLotModel[]> {
		return this.query.lots(actor, itemId, includeEmpty);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => [StockMovementModel], { description: "An item's stock ledger at the selected clinic, newest first." })
	stockLedger(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('itemId', { type: () => ID }) itemId: string,
		@Args('limit', { type: () => Int, defaultValue: 100 }) limit: number,
	): Promise<StockMovementModel[]> {
		return this.query.ledger(actor, itemId, Math.min(Math.max(limit, 1), 500));
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.read })
	@Query(() => InventoryAlertsModel, { description: 'Low stock, expiring (90 days) and expired lots.' })
	inventoryAlerts(@CurrentClinicActor() actor: ClinicActor): Promise<InventoryAlertsModel> {
		return this.query.alerts(actor);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => StockMovementModel, { description: 'Corrects the count of a lot, in or out, with the reason.' })
	adjustStock(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: AdjustStockInput,
	): Promise<StockMovementModel> {
		return this.adjustments.adjust(actor, input);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => StockMovementModel, { description: 'Disposes of an expired lot (EXPIRED_DISPOSAL).' })
	disposeExpiredStock(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: DisposeExpiredStockInput,
	): Promise<StockMovementModel> {
		return this.adjustments.disposeExpired(actor, input);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.stock })
	@Mutation(() => StockMovementModel, { description: 'Writes off damaged stock of a lot (DAMAGED).' })
	recordDamagedStock(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: RecordDamagedStockInput,
	): Promise<StockMovementModel> {
		return this.adjustments.recordDamaged(actor, input);
	}

	@ClinicAccess({ staffRoles: INVENTORY_DESKS.consumption })
	@Mutation(() => [StockMovementModel], {
		description: 'Supplies used on a visit (CONSUMPTION, first expiry first out unless a lot is chosen).',
	})
	recordStockConsumption(
		@CurrentClinicActor() actor: ClinicActor,
		@Args('input') input: RecordConsumptionInput,
	): Promise<StockMovementModel[]> {
		return this.adjustments.recordConsumption(actor, input);
	}
}
