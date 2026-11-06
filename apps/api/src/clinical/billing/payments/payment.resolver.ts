import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { ClinicAccess, ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type BillingActor, CurrentBillingActor, INVOICE_COLLECT_ROLES } from '../billing-access.js';
import { Invoice } from '../invoices/models/invoice.model.js';
import { RecordPaymentInput, RecordPaymentsInput, VoidPaymentInput } from './dto/payment.input.js';
import { PaymentService } from './payment.service.js';

/**
 * Payments at the cashier desk of the selected clinic: cashiers, billing clerks and clinic admins take them (on their
 * open shift); clinic admins void them.
 */
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

	@Mutation(() => Invoice, { description: 'Split tender: several payments on one invoice; returns the invoice.' })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	recordPayments(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: RecordPaymentsInput,
	): Promise<Invoice> {
		return this.payments.recordSplit(actor, input);
	}

	@Mutation(() => Invoice, { description: 'Voids a payment with a reason; returns the invoice it paid.' })
	@ClinicAdmin()
	voidPayment(@CurrentBillingActor() actor: BillingActor, @Args('input') input: VoidPaymentInput): Promise<Invoice> {
		return this.payments.void(actor, input);
	}
}
