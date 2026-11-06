import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { InvoiceSeries as InvoiceSeriesRow } from '../../../../generated/prisma/client.js';
import { InvoiceDocType } from '../../billing.enums.js';

export enum InvoiceSeriesState {
	ACTIVE = 'ACTIVE',
	EXHAUSTED = 'EXHAUSTED',
	EXPIRED = 'EXPIRED',
	INACTIVE = 'INACTIVE',
}

registerEnumType(InvoiceSeriesState, {
	name: 'InvoiceSeriesState',
	description: 'ACTIVE (numbers left, valid today), EXHAUSTED, EXPIRED (past valid until), INACTIVE (turned off).',
});

@ObjectType({ description: "A BIR-registered range of a clinic's invoice numbers (ATP or CAS / PTU permit)." })
export class InvoiceSeries {
	@Field(() => ID)
	id: string;

	@Field(() => InvoiceDocType)
	docType: InvoiceDocType;

	@Field(() => String, { nullable: true })
	prefix: string | null;

	@Field(() => Int)
	startNo: number;

	@Field(() => Int)
	endNo: number;

	@Field(() => Int, { description: 'The number the next issue takes.' })
	nextNo: number;

	@Field(() => Int, { description: 'Numbers left.' })
	remaining: number;

	@Field(() => String, { nullable: true, description: 'ATP number or CAS / PTU permit.' })
	permitNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	permitDate: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD; the last day numbers may be issued.' })
	validUntil: string | null;

	@Field()
	isActive: boolean;

	@Field(() => InvoiceSeriesState)
	state: InvoiceSeriesState;

	@Field({ description: 'The first number as printed.' })
	firstNumber: string;
}

const isoDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/** A series number as printed: the prefix, then the number padded to the digits of the range's end. */
export function formatSeriesNumber(series: { prefix: string | null; endNo: number }, number: number): string {
	return `${series.prefix ?? ''}${String(number).padStart(String(series.endNo).length, '0')}`;
}

export function toInvoiceSeries(row: InvoiceSeriesRow, today: string): InvoiceSeries {
	const validUntil = isoDate(row.validUntil);
	const remaining = Math.max(0, row.endNo - row.nextNo + 1);
	return {
		id: row.id,
		docType: row.docType,
		prefix: row.prefix,
		startNo: row.startNo,
		endNo: row.endNo,
		nextNo: row.nextNo,
		remaining,
		permitNo: row.permitNo,
		permitDate: isoDate(row.permitDate),
		validUntil,
		isActive: row.isActive,
		state: !row.isActive
			? InvoiceSeriesState.INACTIVE
			: validUntil && validUntil < today
				? InvoiceSeriesState.EXPIRED
				: remaining === 0
					? InvoiceSeriesState.EXHAUSTED
					: InvoiceSeriesState.ACTIVE,
		firstNumber: formatSeriesNumber(row, row.startNo),
	};
}
