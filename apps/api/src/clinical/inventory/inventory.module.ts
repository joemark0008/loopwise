import './inventory.enums.js';

import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { InventoryBillingRepository } from './billing/inventory-billing.repository.js';
import { InventoryBillingService } from './billing/inventory-billing.service.js';
import { DispenseQueueService } from './dispensing/dispense-queue.service.js';
import { DispensingRepository } from './dispensing/dispensing.repository.js';
import { DispensingResolver } from './dispensing/dispensing.resolver.js';
import { DispensingService } from './dispensing/dispensing.service.js';
import { InventoryAccess } from './inventory-access.js';
import { INVENTORY_READER } from './inventory-reader.token.js';
import { InventoryWiseReader } from './inventory-wise-reader.js';
import { InventoryItemRepository } from './items/inventory-item.repository.js';
import { InventoryItemService } from './items/inventory-item.service.js';
import { InventoryItemsResolver } from './items/inventory-items.resolver.js';
import { StockReceiptRepository } from './receipts/stock-receipt.repository.js';
import { StockReceiptService } from './receipts/stock-receipt.service.js';
import { StockReceiptsResolver } from './receipts/stock-receipts.resolver.js';
import { StockRepository } from './stock/stock.repository.js';
import { StockResolver } from './stock/stock.resolver.js';
import { StockAdjustmentService } from './stock/stock-adjustment.service.js';
import { StockLedgerService } from './stock/stock-ledger.service.js';
import { StockQueryService } from './stock/stock-query.service.js';
import { SupplierRepository } from './suppliers/supplier.repository.js';
import { SupplierService } from './suppliers/supplier.service.js';
import { SuppliersResolver } from './suppliers/suppliers.resolver.js';

/**
 * Pharmacy and inventory (`inventory.prisma`, DESIGN.md §5.5): the item master and its link to the catalog
 * (`items/`), suppliers (`suppliers/`), receiving deliveries into lots (`receipts/`), the stock ledger with FEFO,
 * adjustments, write-offs, consumption and the alerts (`stock/`), and the dispense queue (`dispensing/`, writing
 * through `PrescriptionService.recordDispensed`). `StockLedgerService` is the one writer of `stock_movements`.
 * Exports `InventoryBillingService` (the cashier's hook into what was dispensed) and `INVENTORY_READER` for Wise.
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, DocumentSequencesModule, GuardsModule, PrescriptionsModule],
	providers: [
		InventoryAccess,
		StockRepository,
		StockLedgerService,
		StockQueryService,
		StockAdjustmentService,
		StockResolver,
		InventoryItemRepository,
		InventoryItemService,
		InventoryItemsResolver,
		SupplierRepository,
		SupplierService,
		SuppliersResolver,
		StockReceiptRepository,
		StockReceiptService,
		StockReceiptsResolver,
		DispensingRepository,
		DispenseQueueService,
		DispensingService,
		DispensingResolver,
		InventoryBillingRepository,
		InventoryBillingService,
		InventoryWiseReader,
		{ provide: INVENTORY_READER, useExisting: InventoryWiseReader },
	],
	exports: [InventoryBillingService, INVENTORY_READER],
})
export class InventoryModule {}
