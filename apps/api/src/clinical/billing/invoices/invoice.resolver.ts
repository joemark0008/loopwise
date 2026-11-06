import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { ClinicAccess, ClinicAdmin } from '../../../common/decorators/access.decorator.js';
import {
	type BillingActor,
	CurrentBillingActor,
	INVOICE_COLLECT_ROLES,
	INVOICE_DRAFT_ROLES,
} from '../billing-access.js';
import { InvoiceChargesService } from '../charges/invoice-charges.service.js';
import {
	IssueInvoiceInput,
	LoadInvoiceChargesInput,
	SaveInvoiceDraftInput,
	VoidInvoiceInput,
} from './dto/invoice.input.js';
import { EncounterBillingService } from './encounter-billing.service.js';
import { InvoiceService } from './invoice.service.js';
import { InvoicePrintService } from './invoice-print.service.js';
import { EncounterBilling } from './models/encounter-billing.model.js';
import { Invoice } from './models/invoice.model.js';
import { PrintableInvoice } from './models/printable-invoice.model.js';

/**
 * Visit invoices at the selected clinic (`x-loopwise-clinic-id`). Drafting and issuing: the doctor and the billing
 * desk; voiding: clinic admins. Row-level security decides which visits are reachable.
 */
@Resolver(() => Invoice)
export class InvoiceResolver {
	constructor(
		private readonly invoices: InvoiceService,
		private readonly charges: InvoiceChargesService,
		private readonly billing: EncounterBillingService,
		private readonly print: InvoicePrintService,
	) {}

	@Query(() => EncounterBilling, { description: "A visit's invoices, price list and charges." })
	@ClinicAccess()
	encounterBilling(
		@CurrentBillingActor() actor: BillingActor,
		@Args('encounterId', { type: () => ID }) encounterId: string,
	): Promise<EncounterBilling> {
		return this.billing.get(actor, encounterId);
	}

	@Query(() => PrintableInvoice, { description: 'An issued invoice as the printed BIR sales invoice shows it.' })
	@ClinicAccess({ staffRoles: [...INVOICE_DRAFT_ROLES, ...INVOICE_COLLECT_ROLES] })
	printableInvoice(
		@CurrentBillingActor() actor: BillingActor,
		@Args('id', { type: () => ID }) id: string,
	): Promise<PrintableInvoice> {
		return this.print.get(actor, id);
	}

	@Mutation(() => Invoice, { description: "Creates or replaces the visit's draft invoice." })
	@ClinicAccess({ staffRoles: INVOICE_DRAFT_ROLES })
	saveInvoiceDraft(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: SaveInvoiceDraftInput,
	): Promise<Invoice> {
		return this.invoices.saveDraft(actor, input);
	}

	@Mutation(() => Invoice, {
		description: "Rebuilds the draft's lines from the visit (consultation, tests, medicines dispensed).",
	})
	@ClinicAccess({ staffRoles: INVOICE_DRAFT_ROLES })
	loadInvoiceCharges(
		@CurrentBillingActor() actor: BillingActor,
		@Args('input') input: LoadInvoiceChargesInput,
	): Promise<Invoice> {
		return this.charges.load(actor, input);
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
		description: 'Voids an invoice (kept, marked void, its number used) and the payments that settle only it.',
	})
	@ClinicAdmin()
	voidInvoice(@CurrentBillingActor() actor: BillingActor, @Args('input') input: VoidInvoiceInput): Promise<Invoice> {
		return this.invoices.void(actor, input);
	}
}
