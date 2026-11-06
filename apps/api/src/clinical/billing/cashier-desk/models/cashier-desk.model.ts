import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import { InvoiceStatus } from '../../billing.enums.js';
import { CashierShift, ShiftMethodTotal } from '../../cashier-shifts/models/cashier-shift.model.js';

@ObjectType({ description: 'An invoice still to settle: a draft, or issued with a balance.' })
export class OpenInvoice {
	@Field(() => ID)
	id: string;

	@Field(() => String, { nullable: true })
	invoiceNo: string | null;

	@Field(() => InvoiceStatus)
	status: InvoiceStatus;

	@Field()
	buyerName: string;

	@Field(() => Float)
	netAmount: number;

	@Field(() => Float)
	balance: number;

	@Field()
	createdAt: Date;

	@Field(() => ID, { nullable: true })
	encounterId: string | null;

	@Field(() => ID, { nullable: true, description: 'For the link to the visit; null when the user may not see them.' })
	patientId: string | null;

	@Field(() => String, { nullable: true })
	encounterNo: string | null;
}

@ObjectType({ description: "The cashier desk: the day's collections, the invoices to settle and the user's shift." })
export class CashierDesk {
	@Field({ description: 'YYYY-MM-DD (Manila).' })
	date: string;

	@Field(() => [ShiftMethodTotal], { description: "The clinic's posted payments of the day, by method." })
	collections: ShiftMethodTotal[];

	@Field(() => Float)
	totalCollected: number;

	@Field(() => [OpenInvoice])
	openInvoices: OpenInvoice[];

	@Field(() => CashierShift, { nullable: true })
	myShift: CashierShift | null;
}
