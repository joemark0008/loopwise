import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { InventoryBillingService } from '../inventory/billing/inventory-billing.service.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { BILLING_READER } from './billing-reader.token.js';
import { CashierDeskResolver } from './cashier-desk/cashier-desk.resolver.js';
import { CashierDeskService } from './cashier-desk/cashier-desk.service.js';
import { CashierShiftRepository } from './cashier-shifts/cashier-shift.repository.js';
import { CashierShiftResolver } from './cashier-shifts/cashier-shift.resolver.js';
import { CashierShiftService } from './cashier-shifts/cashier-shift.service.js';
import { DISPENSED_CHARGES } from './charges/dispensed-charges.port.js';
import { InvoiceChargesService } from './charges/invoice-charges.service.js';
import { VisitChargesRepository } from './charges/visit-charges.repository.js';
import { VisitChargesService } from './charges/visit-charges.service.js';
import { InvoiceDiscountRepository } from './discounts/invoice-discount.repository.js';
import { InvoiceDiscountService } from './discounts/invoice-discount.service.js';
import { InvoiceSeriesRepository } from './invoice-series/invoice-series.repository.js';
import { InvoiceSeriesResolver } from './invoice-series/invoice-series.resolver.js';
import { InvoiceSeriesService } from './invoice-series/invoice-series.service.js';
import { EncounterBillingService } from './invoices/encounter-billing.service.js';
import { InvoiceRepository } from './invoices/invoice.repository.js';
import { InvoiceResolver } from './invoices/invoice.resolver.js';
import { InvoiceService } from './invoices/invoice.service.js';
import { InvoicePrintService } from './invoices/invoice-print.service.js';
import { InvoiceTotalsService } from './invoices/invoice-totals.service.js';
import { PaymentRepository } from './payments/payment.repository.js';
import { PaymentResolver } from './payments/payment.resolver.js';
import { PaymentService } from './payments/payment.service.js';
import { ProfessionalFeeRepository } from './professional-fees/professional-fee.repository.js';
import { ProfessionalFeeResolver } from './professional-fees/professional-fee.resolver.js';
import { ProfessionalFeeService } from './professional-fees/professional-fee.service.js';
import { ServiceCatalogRepository } from './service-items/service-catalog.repository.js';
import { ServiceCatalogResolver } from './service-items/service-catalog.resolver.js';
import { ServiceCatalogService } from './service-items/service-catalog.service.js';
import { ServiceItemRepository } from './service-items/service-item.repository.js';
import { ServiceItemService } from './service-items/service-item.service.js';

/**
 * Billing (`billing.prisma`, DESIGN.md §5.5): the price list (`service-items`), visit invoices with their charges,
 * discounts and BIR numbering (`invoices`, `charges`, `discounts`, `invoice-series`), payments with split tender
 * (`payments`) on cashier shifts with X / Z readings (`cashier-shifts`), doctors' professional fees with EWT
 * (`professional-fees`) and the cashier desk with Wise's `list_billing` reads (`cashier-desk`). Medicines dispensed
 * come from the pharmacy's `InventoryBillingService` through the `DISPENSED_CHARGES` port.
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		DocumentSequencesModule,
		WiseProposalsModule,
		GuardsModule,
		InventoryModule,
	],
	providers: [
		ServiceItemRepository,
		ServiceItemService,
		ServiceCatalogRepository,
		ServiceCatalogService,
		ServiceCatalogResolver,
		InvoiceRepository,
		InvoiceTotalsService,
		InvoiceService,
		InvoicePrintService,
		EncounterBillingService,
		InvoiceResolver,
		// Pharmacy's hook: what was dispensed at a visit (its `DispensedCharge` matches the port's).
		{ provide: DISPENSED_CHARGES, useExisting: InventoryBillingService },
		VisitChargesRepository,
		VisitChargesService,
		InvoiceChargesService,
		InvoiceDiscountRepository,
		InvoiceDiscountService,
		InvoiceSeriesRepository,
		InvoiceSeriesService,
		InvoiceSeriesResolver,
		PaymentRepository,
		PaymentService,
		PaymentResolver,
		CashierShiftRepository,
		CashierShiftService,
		CashierShiftResolver,
		ProfessionalFeeRepository,
		ProfessionalFeeService,
		ProfessionalFeeResolver,
		CashierDeskService,
		CashierDeskResolver,
		{ provide: BILLING_READER, useExisting: CashierDeskService },
	],
	exports: [InvoiceService, ServiceItemService, BILLING_READER],
})
export class BillingModule {}
