import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { DiscountType, TaxType } from '../../billing.enums.js';
import { ServiceItemPrice } from '../../service-items/models/service-item.model.js';
import { Invoice } from './invoice.model.js';

export enum ChargeSource {
	CONSULTATION = 'CONSULTATION',
	DIAGNOSTIC = 'DIAGNOSTIC',
	DISPENSED = 'DISPENSED',
}

registerEnumType(ChargeSource, {
	name: 'ChargeSource',
	description: 'Where a visit charge comes from: the consultation, a test ordered, a medicine dispensed.',
});

@ObjectType({ description: 'A charge of the visit, as "Load charges" puts it on the invoice.' })
export class SuggestedInvoiceLine {
	@Field(() => ChargeSource)
	source: ChargeSource;

	@Field(() => ID, { nullable: true })
	serviceItemId: string | null;

	@Field()
	description: string;

	@Field(() => Float)
	quantity: number;

	@Field(() => Float, { description: 'The price charged; 0 for a test missing from the price list.' })
	unitPrice: number;

	@Field(() => TaxType)
	taxType: TaxType;

	@Field(() => ID, { nullable: true, description: 'Whose fee the line is.' })
	practitionerId: string | null;

	@Field()
	isProfessionalFee: boolean;
}

@ObjectType({ description: "The patient's senior citizen (OSCA) or PWD ID on file." })
export class DiscountIdentification {
	@Field(() => ID)
	id: string;

	@Field(() => DiscountType, { description: 'The discount the ID proves.' })
	discountType: DiscountType;

	@Field()
	idNumber: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	expiresAt: string | null;
}

@ObjectType({ description: 'Someone who may approve another discount at the clinic.' })
export class DiscountApprover {
	@Field(() => ID)
	userId: string;

	@Field()
	name: string;

	@Field(() => [DiscountType], { description: 'EMPLOYEE / PROMO (admins), SPECIAL (admins and doctors).' })
	types: DiscountType[];
}

@ObjectType({ description: "A visit's billing: its invoices and what the desk needs to draft or collect one." })
export class EncounterBilling {
	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	clinicId: string;

	@Field(() => ID)
	patientId: string;

	@Field({ description: 'The organization is VAT-registered (VAT applies to VATable items).' })
	vatRegistered: boolean;

	@Field(() => [Invoice], { description: 'Newest first, voided included; at most one is not void.' })
	invoices: Invoice[];

	@Field(() => [ServiceItemPrice], { description: "The clinic's price list." })
	priceList: ServiceItemPrice[];

	@Field(() => [SuggestedInvoiceLine], { description: 'The charges of the visit ("Load charges").' })
	suggestedLines: SuggestedInvoiceLine[];

	@Field(() => [DiscountIdentification])
	discountIdentifications: DiscountIdentification[];

	@Field(() => [DiscountApprover])
	discountApprovers: DiscountApprover[];

	@Field({ description: 'The user may draft and issue (doctor, cashier, billing clerk or admin at the clinic).' })
	canDraft: boolean;

	@Field({ description: 'The user may take payments (cashier, billing clerk or admin at the clinic).' })
	canCollect: boolean;

	@Field({ description: 'The user may void invoices and payments (a clinic admin).' })
	canVoid: boolean;

	@Field(() => ID, { nullable: true, description: "The user's open cashier shift here (payments need one)." })
	openShiftId: string | null;
}
