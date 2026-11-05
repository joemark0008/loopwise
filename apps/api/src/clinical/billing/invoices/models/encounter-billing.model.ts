import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

import { DiscountType, TaxType } from '../../billing.enums.js';
import { ServiceItemPrice } from '../../service-items/models/service-item.model.js';
import { Invoice } from './invoice.model.js';

@ObjectType({ description: 'A line to start a new invoice with: the consultation and the tests ordered.' })
export class SuggestedInvoiceLine {
	@Field(() => ID, { nullable: true })
	serviceItemId: string | null;

	@Field()
	description: string;

	@Field(() => Float)
	quantity: number;

	@Field(() => Float, { description: 'The clinic price; 0 for a test missing from the price list.' })
	unitPrice: number;

	@Field(() => TaxType)
	taxType: TaxType;
}

@ObjectType({ description: "The patient's senior citizen (OSCA) or PWD ID on file." })
export class DiscountIdentification {
	@Field(() => ID)
	id: string;

	@Field(() => DiscountType, { description: 'The discount the ID proves.' })
	discountType: DiscountType;

	@Field()
	idNumber: string;
}

@ObjectType({ description: "A visit's billing: its invoices and what the desk needs to draft or collect one." })
export class EncounterBilling {
	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	clinicId: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => [Invoice], { description: 'Newest first, voided included; at most one is not void.' })
	invoices: Invoice[];

	@Field(() => [ServiceItemPrice], { description: "The clinic's price list." })
	priceList: ServiceItemPrice[];

	@Field(() => [SuggestedInvoiceLine])
	suggestedLines: SuggestedInvoiceLine[];

	@Field(() => [DiscountIdentification])
	discountIdentifications: DiscountIdentification[];

	@Field({ description: 'The user may draft and issue (doctor, cashier, billing clerk or admin at the clinic).' })
	canDraft: boolean;

	@Field({ description: 'The user may take payments and void (cashier, billing clerk or admin at the clinic).' })
	canCollect: boolean;
}
