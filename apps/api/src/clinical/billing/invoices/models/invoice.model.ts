import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import {
	DiscountType,
	InvoiceDocType,
	InvoiceStatus,
	PaymentMethod,
	PaymentStatus,
	ServiceCategory,
	TaxType,
} from '../../billing.enums.js';

@ObjectType({ description: 'A line of an invoice (pesos).' })
export class InvoiceLine {
	@Field(() => ID)
	id: string;

	@Field(() => ID, { nullable: true, description: 'The catalog item, when the line is one.' })
	serviceItemId: string | null;

	@Field(() => String, { nullable: true })
	serviceItemCode: string | null;

	@Field(() => ServiceCategory, { nullable: true })
	category: ServiceCategory | null;

	@Field(() => ID, { nullable: true, description: 'The visit the charge came from.' })
	encounterId: string | null;

	@Field()
	description: string;

	@Field(() => Float)
	quantity: number;

	@Field(() => Float, { description: 'As charged: VAT included for VATABLE lines.' })
	unitPrice: number;

	@Field(() => TaxType)
	taxType: TaxType;

	@Field(() => Float)
	vatAmount: number;

	@Field(() => Float, { description: 'SC/PWD VAT removed plus discount on the line.' })
	discountAmount: number;

	@Field(() => Float)
	lineTotal: number;

	@Field()
	isProfessionalFee: boolean;
}

@ObjectType({ description: 'A statutory discount with the ID the beneficiary presented (RA 9994 / RA 10754).' })
export class InvoiceDiscount {
	@Field(() => ID)
	id: string;

	@Field(() => DiscountType)
	type: DiscountType;

	@Field(() => Float, { description: '0.2 = 20%.' })
	rate: number;

	@Field(() => Float)
	amount: number;

	@Field(() => Float, { description: 'VAT removed for the beneficiary.' })
	vatExempted: number;

	@Field(() => String, { nullable: true })
	beneficiaryName: string | null;

	@Field(() => String, { nullable: true, description: 'The OSCA / PWD ID number as presented.' })
	idNumber: string | null;

	@Field(() => ID, { nullable: true, description: "The patient's ID on file, when it matched." })
	identificationId: string | null;
}

@ObjectType({ description: 'A payment allocated to an invoice (amount = the part allocated to it).' })
export class InvoicePayment {
	@Field(() => ID)
	id: string;

	@Field()
	paymentNo: string;

	@Field(() => PaymentMethod)
	method: PaymentMethod;

	@Field(() => Float)
	amount: number;

	@Field(() => Float, { nullable: true })
	tenderedAmount: number | null;

	@Field(() => Float, { nullable: true })
	changeAmount: number | null;

	@Field(() => String, { nullable: true, description: 'OR number, e-wallet reference or PhilHealth package code.' })
	referenceNo: string | null;

	@Field(() => PaymentStatus)
	status: PaymentStatus;

	@Field()
	receivedAt: Date;

	@Field(() => String, { nullable: true })
	voidReason: string | null;
}

@ObjectType({ description: 'A sales invoice (BIR, RA 11976). Amounts in pesos.' })
export class Invoice {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	clinicId: string;

	@Field(() => ID, { nullable: true })
	encounterId: string | null;

	@Field(() => InvoiceDocType)
	docType: InvoiceDocType;

	@Field(() => String, { nullable: true, description: 'Assigned when issued.' })
	invoiceNo: string | null;

	@Field()
	invoiceDate: Date;

	@Field(() => InvoiceStatus)
	status: InvoiceStatus;

	@Field(() => Int, { description: 'Moves on every change; pass it back as `expectedVersion`.' })
	version: number;

	@Field()
	buyerName: string;

	@Field(() => [InvoiceLine])
	lines: InvoiceLine[];

	@Field(() => [InvoiceDiscount])
	discounts: InvoiceDiscount[];

	@Field(() => [InvoicePayment], { description: 'Oldest first.' })
	payments: InvoicePayment[];

	@Field(() => Float, { description: 'Total of the lines as charged.' })
	grossAmount: number;

	@Field(() => Float)
	vatableSales: number;

	@Field(() => Float)
	vatExemptSales: number;

	@Field(() => Float)
	zeroRatedSales: number;

	@Field(() => Float)
	vatAmount: number;

	@Field(() => Float, { description: 'VAT removed for a senior citizen / PWD.' })
	lessVatScPwd: number;

	@Field(() => Float)
	scPwdDiscount: number;

	@Field(() => Float)
	otherDiscount: number;

	@Field(() => Float, { description: 'Amount due.' })
	netAmount: number;

	@Field(() => Float)
	amountPaid: number;

	@Field(() => Float)
	balance: number;

	@Field(() => Date, { nullable: true })
	issuedAt: Date | null;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;

	@Field()
	createdAt: Date;
}

export const INVOICE_INCLUDE = {
	lines: { orderBy: { sortOrder: 'asc' }, include: { serviceItem: { select: { code: true, category: true } } } },
	discounts: true,
	allocations: { include: { payment: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

const num = (value: Prisma.Decimal) => value.toNumber();
const optionalNum = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

export function toInvoice(row: InvoiceRow): Invoice {
	return {
		id: row.id,
		clinicId: row.clinicId,
		encounterId: row.encounterId,
		docType: row.docType,
		invoiceNo: row.invoiceNo,
		invoiceDate: row.invoiceDate,
		status: row.status,
		version: row.version,
		buyerName: row.buyerName,
		lines: row.lines.map((line) => ({
			id: line.id,
			serviceItemId: line.serviceItemId,
			serviceItemCode: line.serviceItem?.code ?? null,
			category: line.serviceItem?.category ?? null,
			encounterId: line.encounterId,
			description: line.description,
			quantity: num(line.quantity),
			unitPrice: num(line.unitPrice),
			taxType: line.taxType,
			vatAmount: num(line.vatAmount),
			discountAmount: num(line.discountAmount),
			lineTotal: num(line.lineTotal),
			isProfessionalFee: line.isProfessionalFee,
		})),
		discounts: row.discounts.map((discount) => ({
			id: discount.id,
			type: discount.type,
			rate: num(discount.rate),
			amount: num(discount.amount),
			vatExempted: num(discount.vatExempted),
			beneficiaryName: discount.beneficiaryName,
			idNumber: discount.idNumber,
			identificationId: discount.identificationId,
		})),
		payments: [...row.allocations]
			.sort((a, b) => a.payment.receivedAt.getTime() - b.payment.receivedAt.getTime())
			.map(({ amount, payment }) => ({
				id: payment.id,
				paymentNo: payment.paymentNo,
				method: payment.method,
				amount: num(amount),
				tenderedAmount: optionalNum(payment.tenderedAmount),
				changeAmount: optionalNum(payment.changeAmount),
				referenceNo: payment.referenceNo,
				status: payment.status,
				receivedAt: payment.receivedAt,
				voidReason: payment.voidReason,
			})),
		grossAmount: num(row.grossAmount),
		vatableSales: num(row.vatableSales),
		vatExemptSales: num(row.vatExemptSales),
		zeroRatedSales: num(row.zeroRatedSales),
		vatAmount: num(row.vatAmount),
		lessVatScPwd: num(row.lessVatScPwd),
		scPwdDiscount: num(row.scPwdDiscount),
		otherDiscount: num(row.otherDiscount),
		netAmount: num(row.netAmount),
		amountPaid: num(row.amountPaid),
		balance: num(row.balance),
		issuedAt: row.issuedAt,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
		createdAt: row.createdAt,
	};
}
