import { Injectable } from '@nestjs/common';

import type { InvoiceDocType, InvoiceSeries, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';

/** The outcome of taking a number from the clinic's series. */
export type SeriesTake =
	| { kind: 'taken'; seriesId: string; prefix: string | null; endNo: number; number: number }
	| { kind: 'exhausted'; seriesId: string }
	| { kind: 'expired'; seriesId: string }
	| { kind: 'inactive'; seriesId: string }
	| { kind: 'none' };

/** `invoice_series` (BIR ATP / CAS permits). Runs inside the caller's (RLS) transaction: the clinic is the boundary. */
@Injectable()
export class InvoiceSeriesRepository {
	list(tx: ClinicalTx, clinicId: string): Promise<InvoiceSeries[]> {
		return tx.invoiceSeries.findMany({
			where: { clinicId },
			orderBy: [{ docType: 'asc' }, { isActive: 'desc' }, { startNo: 'asc' }],
		});
	}

	findById(tx: ClinicalTx, id: string): Promise<InvoiceSeries | null> {
		return tx.invoiceSeries.findUnique({ where: { id } });
	}

	/** Another series of the clinic, doc type and prefix whose numbers overlap `[startNo, endNo]`. */
	findOverlap(
		tx: ClinicalTx,
		series: { clinicId: string; docType: InvoiceDocType; prefix: string | null; startNo: number; endNo: number },
		excludeId?: string,
	): Promise<InvoiceSeries | null> {
		return tx.invoiceSeries.findFirst({
			where: {
				clinicId: series.clinicId,
				docType: series.docType,
				prefix: series.prefix,
				startNo: { lte: series.endNo },
				endNo: { gte: series.startNo },
				...(excludeId ? { id: { not: excludeId } } : {}),
			},
		});
	}

	create(tx: ClinicalTx, data: Prisma.InvoiceSeriesUncheckedCreateInput): Promise<InvoiceSeries> {
		return tx.invoiceSeries.create({ data });
	}

	update(tx: ClinicalTx, id: string, data: Prisma.InvoiceSeriesUncheckedUpdateInput): Promise<InvoiceSeries> {
		return tx.invoiceSeries.update({ where: { id }, data });
	}

	/**
	 * Takes the next number of the clinic's first usable series of `docType` (active, valid today in Manila, numbers
	 * left) in one statement; the row lock makes concurrent issues wait, so no number is given twice. When none is
	 * usable, says why: every active series is exhausted, or past its validity, or every series is turned off, or the
	 * clinic has registered none.
	 */
	async take(tx: ClinicalTx, clinicId: string, docType: InvoiceDocType): Promise<SeriesTake> {
		const [taken] = await tx.$queryRaw<{ id: string; prefix: string | null; end_no: number; number: number }[]>`
			UPDATE invoice_series SET next_no = next_no + 1
			WHERE id = (
				SELECT id FROM invoice_series
				WHERE clinic_id = ${clinicId}::uuid AND doc_type = ${docType}::invoice_doc_type AND is_active
					AND next_no <= end_no
					AND (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE 'Asia/Manila')::date)
				ORDER BY start_no
				LIMIT 1
				FOR UPDATE
			) AND next_no <= end_no
			RETURNING id, prefix, end_no, next_no - 1 AS number`;
		if (taken) {
			return {
				kind: 'taken',
				seriesId: taken.id,
				prefix: taken.prefix,
				endNo: taken.end_no,
				number: taken.number,
			};
		}
		const [active] = await tx.$queryRaw<{ id: string; usable_date: boolean }[]>`
			SELECT id, (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE 'Asia/Manila')::date) AS usable_date
			FROM invoice_series
			WHERE clinic_id = ${clinicId}::uuid AND doc_type = ${docType}::invoice_doc_type AND is_active
			ORDER BY (valid_until IS NULL OR valid_until >= (now() AT TIME ZONE 'Asia/Manila')::date) DESC, start_no
			LIMIT 1`;
		if (!active) {
			const [registered] = await tx.$queryRaw<{ id: string }[]>`
				SELECT id FROM invoice_series
				WHERE clinic_id = ${clinicId}::uuid AND doc_type = ${docType}::invoice_doc_type
				ORDER BY start_no
				LIMIT 1`;
			return registered ? { kind: 'inactive', seriesId: registered.id } : { kind: 'none' };
		}
		return active.usable_date
			? { kind: 'exhausted', seriesId: active.id }
			: { kind: 'expired', seriesId: active.id };
	}
}
