import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import { Prisma } from '../../../../generated/prisma/client.js';
import { PfStatus } from '../../billing.enums.js';
import type { ProfessionalFeeRow } from '../professional-fee.repository.js';

@ObjectType({ description: "A doctor's professional fee from an issued invoice line (pesos)." })
export class ProfessionalFee {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	practitionerId: string;

	@Field(() => ID, { nullable: true })
	invoiceId: string | null;

	@Field(() => String, { nullable: true })
	invoiceNo: string | null;

	@Field(() => Date, { nullable: true })
	invoiceDate: Date | null;

	@Field(() => String, { nullable: true, description: 'The line billed.' })
	description: string | null;

	@Field(() => Float, { description: 'The line as billed, net of VAT.' })
	grossAmount: number;

	@Field(() => Float)
	clinicShare: number;

	@Field(() => Float, { description: '0.1 = 10%.' })
	ewtRate: number;

	@Field(() => Float, { description: 'Expanded withholding tax withheld (BIR 2307).' })
	ewtAmount: number;

	@Field(() => Float)
	netPayable: number;

	@Field(() => PfStatus)
	status: PfStatus;

	@Field(() => Date, { nullable: true })
	releasedAt: Date | null;

	@Field(() => String, { nullable: true })
	releaseRef: string | null;

	@Field()
	createdAt: Date;
}

@ObjectType({ description: "One doctor's fees in the period, with their totals." })
export class ProfessionalFeeDoctor {
	@Field(() => ID)
	practitionerId: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true, description: "The doctor's TIN, for BIR 2307." })
	tin: string | null;

	@Field(() => Int)
	count: number;

	@Field(() => Float)
	grossAmount: number;

	@Field(() => Float)
	clinicShare: number;

	@Field(() => Float)
	ewtAmount: number;

	@Field(() => Float)
	netPayable: number;

	@Field(() => Float, { description: 'Net payable not released yet (UNPAID and FOR_RELEASE).' })
	unreleased: number;

	@Field(() => [ProfessionalFee])
	fees: ProfessionalFee[];
}

@ObjectType({ description: "The clinic's professional fees of a period (Manila dates), by doctor." })
export class ProfessionalFeeReport {
	@Field({ description: 'YYYY-MM-DD.' })
	from: string;

	@Field({ description: 'YYYY-MM-DD.' })
	to: string;

	@Field({ description: 'YYYY-MM-DD.' })
	generatedOn: string;

	@Field(() => [ProfessionalFeeDoctor])
	doctors: ProfessionalFeeDoctor[];

	@Field(() => Float)
	grossAmount: number;

	@Field(() => Float)
	ewtAmount: number;

	@Field(() => Float)
	netPayable: number;
}

const ZERO = new Prisma.Decimal(0);

export function toProfessionalFee(row: ProfessionalFeeRow): ProfessionalFee {
	return {
		id: row.id,
		practitionerId: row.practitionerId,
		invoiceId: row.invoiceLine?.invoice.id ?? null,
		invoiceNo: row.invoiceLine?.invoice.invoiceNo ?? null,
		invoiceDate: row.invoiceLine?.invoice.invoiceDate ?? null,
		description: row.invoiceLine?.description ?? null,
		grossAmount: row.grossAmount.toNumber(),
		clinicShare: row.clinicShare.toNumber(),
		ewtRate: row.ewtRate.toNumber(),
		ewtAmount: row.ewtAmount.toNumber(),
		netPayable: row.netPayable.toNumber(),
		status: row.status,
		releasedAt: row.releasedAt,
		releaseRef: row.releaseRef,
		createdAt: row.createdAt,
	};
}

/** Groups the fees by doctor and adds them up (cancelled fees are listed, not counted). */
export function toProfessionalFeeReport(
	rows: readonly ProfessionalFeeRow[],
	period: { from: string; to: string; generatedOn: string },
): ProfessionalFeeReport {
	const doctors = new Map<string, { row: ProfessionalFeeRow; fees: ProfessionalFeeRow[] }>();
	for (const row of rows) {
		const entry = doctors.get(row.practitionerId) ?? { row, fees: [] };
		entry.fees.push(row);
		doctors.set(row.practitionerId, entry);
	}
	const add = (fees: readonly ProfessionalFeeRow[], pick: (row: ProfessionalFeeRow) => Prisma.Decimal) =>
		fees.filter((fee) => fee.status !== 'CANCELLED').reduce((total, fee) => total.plus(pick(fee)), ZERO);
	const counted = rows.filter((row) => row.status !== 'CANCELLED');
	return {
		...period,
		doctors: [...doctors.values()]
			.map(({ row, fees }) => {
				const { firstName, lastName, suffix, tin } = row.practitioner;
				return {
					practitionerId: row.practitionerId,
					name: ['Dr.', firstName, lastName, suffix].filter(Boolean).join(' '),
					tin,
					count: fees.filter((fee) => fee.status !== 'CANCELLED').length,
					grossAmount: add(fees, (fee) => fee.grossAmount).toNumber(),
					clinicShare: add(fees, (fee) => fee.clinicShare).toNumber(),
					ewtAmount: add(fees, (fee) => fee.ewtAmount).toNumber(),
					netPayable: add(fees, (fee) => fee.netPayable).toNumber(),
					unreleased: add(
						fees.filter((fee) => fee.status === 'UNPAID' || fee.status === 'FOR_RELEASE'),
						(fee) => fee.netPayable,
					).toNumber(),
					fees: fees.map(toProfessionalFee),
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name)),
		grossAmount: add(counted, (fee) => fee.grossAmount).toNumber(),
		ewtAmount: add(counted, (fee) => fee.ewtAmount).toNumber(),
		netPayable: add(counted, (fee) => fee.netPayable).toNumber(),
	};
}
