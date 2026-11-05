import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess } from '../../../common/decorators/access.decorator.js';
import {
	type BillingActor,
	CurrentBillingActor,
	INVOICE_COLLECT_ROLES,
	INVOICE_DRAFT_ROLES,
} from '../billing-access.js';
import { IssueInvoiceInput, SaveInvoiceDraftInput, VoidInvoiceInput } from './dto/invoice.input.js';
import { EncounterBillingService } from './encounter-billing.service.js';
import { InvoiceService } from './invoice.service.js';
import { EncounterBilling } from './models/encounter-billing.model.js';
import { Invoice } from './models/invoice.model.js';

/**
 * Visit invoices at the selected clinic (`x-loopwise-clinic-id`). Drafting and issuing: the doctor and the billing
 * desk; voiding: the billing desk; clinic admins always. Row-level security decides which visits are reachable.
 */
@Resolver(() => Invoice)
export class InvoiceResolver {
	constructor(
		private readonly invoices: InvoiceService,
		private readonly billing: EncounterBillingService,
	) {}

	@Query(() => EncounterBilling, { description: "A visit's invoices, price list and suggested lines." })
	@ClinicAccess()
	encounterBilling(
		@CurrentBillingActor() actor: BillingActor,
		@Args('encounterId', { type: () => ID }) encounterId: string,
	): Promise<EncounterBilling> {
		return this.billing.get(actor, encounterId);
	}

	@Mutation(() => Invoice, { description: "Creates or replaces the visit's draft invoice." })
	@ClinicAccess({ staffRoles: INVOICE_DRAFT_ROLES })
	saveInvoiceDraft(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: SaveInvoiceDraftInput,
	): Promise<Invoice> {
		return this.invoices.saveDraft(actor, input);
	}

	@Mutation(() => Invoice, { description: 'Numbers and locks a draft; it can then only be paid or voided.' })
	@ClinicAccess({ staffRoles: INVOICE_DRAFT_ROLES })
	issueInvoice(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: IssueInvoiceInput,
	): Promise<Invoice> {
		return this.invoices.issue(actor, input);
	}

	@Mutation(() => Invoice, {
		description: 'Voids an invoice (kept, marked void) and the payments that settle only it.',
	})
	@ClinicAccess({ staffRoles: INVOICE_COLLECT_ROLES })
	voidInvoice(@CurrentBillingActor() actor: BillingActor, @Args('input') input: VoidInvoiceInput): Promise<Invoice> {
		return this.invoices.void(actor, input);
	}
}
