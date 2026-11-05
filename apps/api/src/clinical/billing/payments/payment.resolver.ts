import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import { type BillingActor, CurrentBillingActor, INVOICE_COLLECT_ROLES } from '../billing-access.js';
import { Invoice } from '../invoices/models/invoice.model.js';
import { RecordPaymentInput } from './dto/payment.input.js';
import { PaymentService } from './payment.service.js';

/** Payments at the cashier desk of the selected clinic: cashiers, billing clerks and clinic admins. */
@Resolver()
export class PaymentResolver {
	constructor(private readonly payments: PaymentService) {}

	@Mutation(() => Invoice, { description: 'Records a payment against an issued invoice; returns the invoice.' })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	recordPayment(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: RecordPaymentInput,
	): Promise<Invoice> {
		return this.payments.record(actor, input);
	}
}
