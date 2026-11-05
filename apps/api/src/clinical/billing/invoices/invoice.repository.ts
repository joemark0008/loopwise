import { Injectable } from '@nestjs/common';

import type { IdentificationType, InvoiceDocType, Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { INVOICE_INCLUDE, type InvoiceRow } from './models/invoice.model.js';

/** What billing reads of a visit: its clinic, patient and doctor (for the buyer, the numbering and PF lines). */
export const BILLING_ENCOUNTER_SELECT = {
	id: true,
	clinicId: true,
	patientId: true,
	practitionerId: true,
	clinic: { select: { id: true, code: true, organizationId: true } },
	patient: { select: { firstName: true, middleName: true, lastName: true, suffix: true } },
} satisfies Prisma.EncounterSelect;

export type BillingEncounter = Prisma.EncounterGetPayload<{ select: typeof BILLING_ENCOUNTER_SELECT }>;

export type InvoiceLineData = Omit<Prisma.InvoiceLineCreateManyInput, 'invoiceId'>;
export type InvoiceDiscountData = Omit<Prisma.InvoiceDiscountCreateManyInput, 'invoiceId'>;

/**
 * `invoices` with their lines, discounts and payment allocations. Every method runs inside the caller's
 * `ClinicalDbService` transaction, so row-level security applies (a visit's invoice is written only by staff of its
 * clinic who may see the patient).
 */
@Injectable()
export class InvoiceRepository {
	/** The visit, or null when it doesn't exist or the user may not see its patient. */
	findEncounter(tx: ClinicalTx, encounterId: string): Promise<BillingEncounter | null> {
		return tx.encounter.findUnique({ where: { id: encounterId }, select: BILLING_ENCOUNTER_SELECT });
	}

	/**
	 * Serializes billing writes of one visit until the transaction ends (a transaction-scoped advisory lock), so two
	 * desks can't both open an invoice for it.
	 */
	async lockEncounter(tx: ClinicalTx, encounterId: string): Promise<void> {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invoice:${encounterId}`}, 0))`;
	}

	findById(tx: ClinicalTx, id: string): Promise<InvoiceRow | null> {
		return tx.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
	}

	/** The visit's invoices, newest first, voided included. */
	listForEncounter(tx: ClinicalTx, encounterId: string): Promise<InvoiceRow[]> {
		return tx.invoice.findMany({
			where: { encounterId },
			include: INVOICE_INCLUDE,
			orderBy: { createdAt: 'desc' },
		});
	}

	/** The visit's invoice that is not void (at most one: `InvoiceService` keeps it so). */
	findActiveForEncounter(tx: ClinicalTx, encounterId: string): Promise<InvoiceRow | null> {
		return tx.invoice.findFirst({
			where: { encounterId, status: { not: 'VOID' } },
			include: INVOICE_INCLUDE,
			orderBy: { createdAt: 'desc' },
		});
	}

	createDraft(
		tx: ClinicalTx,
		data: Omit<Prisma.InvoiceUncheckedCreateInput, 'lines' | 'discounts' | 'status'>,
		lines: InvoiceLineData[],
		discounts: InvoiceDiscountData[],
	): Promise<InvoiceRow> {
		return tx.invoice.create({
			data: {
				...data,
				status: 'DRAFT',
				lines: { createMany: { data: lines } },
				discounts: { createMany: { data: discounts } },
			},
			include: INVOICE_INCLUDE,
		});
	}

	/**
	 * Replaces a draft's buyer, totals, lines and discounts. Null when it is no longer a draft at `expectedVersion`
	 * (someone saved, issued or voided it first); the lock triggers refuse it after issue anyway.
	 */
	async replaceDraft(
		tx: ClinicalTx,
		id: string,
		expectedVersion: number,
		data: Prisma.InvoiceUncheckedUpdateManyInput,
		lines: InvoiceLineData[],
		discounts: InvoiceDiscountData[],
	): Promise<InvoiceRow | null> {
		const { count } = await tx.invoice.updateMany({
			where: { id, status: 'DRAFT', version: expectedVersion },
			data,
		});
		if (count === 0) {
			return null;
		}
		await tx.invoiceDiscount.deleteMany({ where: { invoiceId: id } });
		await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
		await tx.invoiceLine.createMany({ data: lines.map((line) => ({ ...line, invoiceId: id })) });
		await tx.invoiceDiscount.createMany({ data: discounts.map((discount) => ({ ...discount, invoiceId: id })) });
		return this.findById(tx, id);
	}

	/** Updates the invoice if it is still at `expectedVersion`; null when it moved on. */
	async updateAtVersion(
		tx: ClinicalTx,
		id: string,
		expectedVersion: number,
		data: Prisma.InvoiceUncheckedUpdateManyInput,
	): Promise<InvoiceRow | null> {
		const { count } = await tx.invoice.updateMany({ where: { id, version: expectedVersion }, data });
		return count === 0 ? null : this.findById(tx, id);
	}

	/**
	 * Takes the next number of the clinic's active BIR series (ATP / CAS permit) for `docType`, valid today, in one
	 * statement. `null` when the clinic has no active series; `{ exhausted }` when its numbers ran out.
	 */
	async takeSeriesNumber(
		tx: ClinicalTx,
		clinicId: string,
		docType: InvoiceDocType,
	): Promise<{ seriesId: string; invoiceNo: string } | { exhausted: string } | null> {
		const series = await tx.invoiceSeries.findFirst({
			where: {
				clinicId,
				docType,
				isActive: true,
				OR: [{ validUntil: null }, { validUntil: { gte: startOfToday() } }],
			},
			orderBy: { startNo: 'asc' },
		});
		if (!series) {
			return null;
		}
		const [taken] = await tx.$queryRaw<{ number: number }[]>`
			UPDATE invoice_series SET next_no = next_no + 1
			WHERE id = ${series.id}::uuid AND next_no <= end_no
			RETURNING next_no - 1 AS number`;
		if (!taken) {
			return { exhausted: series.id };
		}
		const digits = String(series.endNo).length;
		return {
			seriesId: series.id,
			invoiceNo: `${series.prefix ?? ''}${String(taken.number).padStart(digits, '0')}`,
		};
	}

	/**
	 * Voids the posted payments that settle only this invoice (a payment split over several invoices stays).
	 * Returns their ids.
	 */
	async voidPaymentsOf(tx: ClinicalTx, invoiceId: string, voidReason: string): Promise<string[]> {
		const payments = await tx.payment.findMany({
			where: { status: 'POSTED', allocations: { some: { invoiceId }, every: { invoiceId } } },
			select: { id: true },
		});
		const ids = payments.map((payment) => payment.id);
		if (ids.length > 0) {
			await tx.payment.updateMany({ where: { id: { in: ids } }, data: { status: 'VOIDED', voidReason } });
		}
		return ids;
	}

	/** The patient's ID of `type` with this number (as presented: spaces and case ignored), when on file. */
	async findIdentification(
		tx: ClinicalTx,
		patientId: string,
		type: IdentificationType,
		idNumber: string,
	): Promise<{ id: string } | null> {
		const ids = await tx.patientIdentification.findMany({
			where: { patientId, type },
			select: { id: true, idNumber: true },
		});
		const wanted = normalizeId(idNumber);
		return ids.find((id) => normalizeId(id.idNumber) === wanted) ?? null;
	}

	/** The patient's senior citizen (OSCA) and PWD IDs on file. */
	listDiscountIdentifications(
		tx: ClinicalTx,
		patientId: string,
		types: readonly IdentificationType[],
	): Promise<{ id: string; type: IdentificationType; idNumber: string }[]> {
		return tx.patientIdentification.findMany({
			where: { patientId, type: { in: [...types] } },
			select: { id: true, type: true, idNumber: true },
			orderBy: { createdAt: 'asc' },
		});
	}

	/** The tests ordered at the visit (not cancelled), to pre-fill the invoice. */
	listOrderedTests(tx: ClinicalTx, encounterId: string): Promise<{ testId: string; name: string }[]> {
		return tx.diagnosticOrderItem
			.findMany({
				where: { order: { encounterId }, status: { not: 'CANCELLED' } },
				select: { testId: true, test: { select: { name: true } } },
				orderBy: { id: 'asc' },
			})
			.then((items) => items.map((item) => ({ testId: item.testId, name: item.test.name })));
	}
}

const normalizeId = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();

function startOfToday(): Date {
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);
	return today;
}
