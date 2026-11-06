import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess, ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import { type BillingActor, CurrentBillingActor, INVOICE_COLLECT_ROLES } from '../billing-access.js';
import { CreateInvoiceSeriesInput, UpdateInvoiceSeriesInput } from './dto/invoice-series.input.js';
import { InvoiceSeriesService } from './invoice-series.service.js';
import { InvoiceSeries } from './models/invoice-series.model.js';

/** The selected clinic's BIR invoice series: the billing desk reads them; clinic admins register and change them. */
@Resolver(() => InvoiceSeries)
export class InvoiceSeriesResolver {
	constructor(private readonly series: InvoiceSeriesService) {}

	@Query(() => [InvoiceSeries], { description: "The clinic's invoice series, active first." })
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	invoiceSeries(@CurrentBillingActor() actor: BillingActor): Promise<InvoiceSeries[]> {
		return this.series.list(actor);
	}

	@Mutation(() => InvoiceSeries, { description: 'Registers a BIR series (ATP / CAS permit and range).' })
	@ClinicAdmin()
	createInvoiceSeries(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: CreateInvoiceSeriesInput,
	): Promise<InvoiceSeries> {
		return this.series.create(actor, input);
	}

	@Mutation(() => InvoiceSeries, { description: "Changes a series' permit details, validity or on / off." })
	@ClinicAdmin()
	updateInvoiceSeries(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: UpdateInvoiceSeriesInput,
	): Promise<InvoiceSeries> {
		return this.series.update(actor, input);
	}
}
