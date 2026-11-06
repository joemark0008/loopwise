import { Field, ObjectType } from '@nestjs/graphql';

import { Invoice } from './invoice.model.js';

@ObjectType({ description: 'The seller as registered with the BIR (the organization) and the clinic (branch).' })
export class InvoiceSeller {
	@Field({ description: 'Registered name (SEC / DTI).' })
	registeredName: string;

	@Field(() => String, { nullable: true })
	tradeName: string | null;

	@Field(() => String, { nullable: true })
	tin: string | null;

	@Field()
	vatRegistered: boolean;

	@Field(() => String, { nullable: true, description: 'The clinic\'s BIR branch code, e.g. "00001".' })
	birBranchCode: string | null;

	@Field()
	clinicName: string;

	@Field(() => String, { nullable: true })
	address: string | null;

	@Field(() => String, { nullable: true })
	contactNo: string | null;
}

@ObjectType({ description: 'The BIR permit the invoice number belongs to.' })
export class InvoicePermit {
	@Field(() => String, { nullable: true, description: 'ATP number or CAS / PTU permit.' })
	permitNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	permitDate: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	validUntil: string | null;

	@Field({ description: 'The series range as printed, e.g. "SI-00001 – SI-50000".' })
	range: string;
}

@ObjectType({ description: 'A sales invoice with what the printed BIR invoice shows.' })
export class PrintableInvoice {
	@Field(() => Invoice)
	invoice: Invoice;

	@Field(() => InvoiceSeller)
	seller: InvoiceSeller;

	@Field(() => InvoicePermit, { nullable: true, description: 'None when numbered from the document sequence.' })
	permit: InvoicePermit | null;

	@Field(() => String, { nullable: true, description: "The buyer's TIN (a corporate buyer)." })
	buyerTin: string | null;

	@Field(() => String, { nullable: true })
	buyerAddress: string | null;
}
