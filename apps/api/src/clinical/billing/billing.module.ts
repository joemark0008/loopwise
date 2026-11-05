import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { EncounterBillingService } from './invoices/encounter-billing.service.js';
import { InvoiceRepository } from './invoices/invoice.repository.js';
import { InvoiceResolver } from './invoices/invoice.resolver.js';
import { InvoiceService } from './invoices/invoice.service.js';
import { InvoiceTotalsService } from './invoices/invoice-totals.service.js';
import { PaymentRepository } from './payments/payment.repository.js';
import { PaymentResolver } from './payments/payment.resolver.js';
import { PaymentService } from './payments/payment.service.js';
import { ServiceItemRepository } from './service-items/service-item.repository.js';
import { ServiceItemService } from './service-items/service-item.service.js';

/**
 * Billing (`billing.prisma`): the price list (`service-items`), visit invoices with the senior citizen / PWD discount
 * (`invoices`) and payments at the cashier desk, PhilHealth package coverage included (`payments`).
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, DocumentSequencesModule, WiseProposalsModule],
	providers: [
		ServiceItemRepository,
		ServiceItemService,
		InvoiceRepository,
		InvoiceTotalsService,
		InvoiceService,
		EncounterBillingService,
		InvoiceResolver,
		PaymentRepository,
		PaymentService,
		PaymentResolver,
	],
	exports: [InvoiceService, ServiceItemService],
})
export class BillingModule {}
