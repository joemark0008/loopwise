import { Injectable } from '@nestjs/common';

import type { PfStatus, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

export const PROFESSIONAL_FEE_INCLUDE = {
	practitioner: { select: { id: true, firstName: true, lastName: true, suffix: true, tin: true } },
	invoiceLine: {
		select: {
			description: true,
			invoice: { select: { id: true, invoiceNo: true, invoiceDate: true, clinicId: true, buyerName: true } },
		},
	},
} satisfies Prisma.ProfessionalFeeInclude;

export type ProfessionalFeeRow = Prisma.ProfessionalFeeGetPayload<{ include: typeof PROFESSIONAL_FEE_INCLUDE }>;

/** `professional_fees`. Runs inside the caller's (RLS) transaction: a doctor sees their own, the billing desk the clinic's. */
@Injectable()
export class ProfessionalFeeRepository {
	createMany(tx: ClinicalTx, rows: Prisma.ProfessionalFeeCreateManyInput[]): Promise<{ count: number }> {
		return tx.professionalFee.createMany({ data: rows });
	}

	listForInvoice(tx: ClinicalTx, invoiceId: string): Promise<{ id: string; status: PfStatus }[]> {
		return tx.professionalFee.findMany({
			where: { invoiceLine: { invoiceId } },
			select: { id: true, status: true },
		});
	}

	setStatus(
		tx: ClinicalTx,
		ids: readonly string[],
		from: readonly PfStatus[],
		data: Prisma.ProfessionalFeeUncheckedUpdateManyInput,
	): Promise<{ count: number }> {
		return tx.professionalFee.updateMany({ where: { id: { in: [...ids] }, status: { in: [...from] } }, data });
	}

	findByIds(tx: ClinicalTx, ids: readonly string[]): Promise<ProfessionalFeeRow[]> {
		return tx.professionalFee.findMany({ where: { id: { in: [...ids] } }, include: PROFESSIONAL_FEE_INCLUDE });
	}

	/** The clinic's fees created in `[from, to)`, by doctor then date. */
	list(
		tx: ClinicalTx,
		filter: { clinicId: string; from: Date; to: Date; practitionerId?: string | null; status?: PfStatus | null },
	): Promise<ProfessionalFeeRow[]> {
		return tx.professionalFee.findMany({
			where: {
				createdAt: { gte: filter.from, lt: filter.to },
				invoiceLine: { invoice: { clinicId: filter.clinicId } },
				...(filter.practitionerId ? { practitionerId: filter.practitionerId } : {}),
				...(filter.status ? { status: filter.status } : {}),
			},
			include: PROFESSIONAL_FEE_INCLUDE,
			orderBy: [{ practitionerId: 'asc' }, { createdAt: 'asc' }],
		});
	}
}
