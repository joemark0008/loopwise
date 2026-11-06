import './inventory.enums.js';

import { Module } from '@nestjs/common';

import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { InventoryBillingRepository } from './billing/inventory-billing.repository.js';
import { InventoryBillingService } from './billing/inventory-billing.service.js';
import { StockRepository } from './stock/stock.repository.js';
import { StockLedgerService } from './stock/stock-ledger.service.js';

/**
 * Pharmacy and inventory (`inventory.prisma`, DESIGN.md §5.5): the item master, suppliers, receiving, the stock
 * ledger, the dispense queue and the alerts. `InventoryBillingService` is the cashier's hook into what was dispensed.
 */
@Module({
	imports: [ClinicalDbModule],
	providers: [StockRepository, StockLedgerService, InventoryBillingRepository, InventoryBillingService],
	exports: [InventoryBillingService],
})
export class InventoryModule {}
