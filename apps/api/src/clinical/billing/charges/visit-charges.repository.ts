import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** What a visit is charged for, read inside the caller's (RLS) transaction. */
@Injectable()
export class VisitChargesRepository {
	/** The tests ordered at the visit (not cancelled). */
	listOrderedTests(tx: ClinicalTx, encounterId: string): Promise<{ testId: string; name: string }[]> {
		return tx.diagnosticOrderItem
			.findMany({
				where: { order: { encounterId }, status: { not: 'CANCELLED' } },
				select: { testId: true, test: { select: { name: true } } },
				orderBy: { id: 'asc' },
			})
			.then((items) => items.map((item) => ({ testId: item.testId, name: item.test.name })));
	}

	/** The doctor's terms at the clinic: consult fee (else their default) and fee terms; null when not linked. */
	findPractitionerTerms(
		tx: ClinicalTx,
		practitionerId: string,
		clinicId: string,
	): Promise<{
		consultFee: Prisma.Decimal | null;
		ewtRate: Prisma.Decimal | null;
		clinicShareRate: Prisma.Decimal;
		practitioner: { firstName: string; lastName: string; defaultConsultFee: Prisma.Decimal | null };
	} | null> {
		return tx.practitionerClinic.findUnique({
			where: { practitionerId_clinicId: { practitionerId, clinicId } },
			select: {
				consultFee: true,
				ewtRate: true,
				clinicShareRate: true,
				practitioner: { select: { firstName: true, lastName: true, defaultConsultFee: true } },
			},
		});
	}

	/** The pharmacy ledger rows the visit's other invoices (not void, not `exceptInvoiceId`) already bill. */
	async billedStockMovementIds(
		tx: ClinicalTx,
		encounterId: string,
		exceptInvoiceId: string | null,
	): Promise<Set<string>> {
		const lines = await tx.invoiceLine.findMany({
			where: {
				invoice: {
					encounterId,
					status: { not: 'VOID' },
					...(exceptInvoiceId ? { id: { not: exceptInvoiceId } } : {}),
				},
				stockMovementIds: { isEmpty: false },
			},
			select: { stockMovementIds: true },
		});
		return new Set(lines.flatMap((line) => line.stockMovementIds));
	}

	/** Of `ids`, the practitioners who hold clinic at `clinicId`. */
	async practitionersAt(tx: ClinicalTx, clinicId: string, ids: readonly string[]): Promise<Set<string>> {
		if (ids.length === 0) {
			return new Set();
		}
		const rows = await tx.practitionerClinic.findMany({
			where: { clinicId, practitionerId: { in: [...ids] } },
			select: { practitionerId: true },
		});
		return new Set(rows.map((row) => row.practitionerId));
	}
}
