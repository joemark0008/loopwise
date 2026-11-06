import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { INVOICE_INCLUDE, type InvoiceRow } from './models/invoice.model.js';

/**
 * What billing reads of a visit: its clinic (and whether its organization is VAT-registered), patient and doctor (for the
 * buyer, the numbering, VAT and the PF lines).
 */
export const BILLING_ENCOUNTER_SELECT = {
	id: true,
	clinicId: true,
	patientId: true,
	practitionerId: true,
	type: true,
	clinic: {
		select: { id: true, code: true, organizationId: true, organization: { select: { vatRegistration: true } } },
	},
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

	/** The seller of a clinic's invoices: the organization's registration and the clinic (branch) with its address. */
	findSeller(tx: ClinicalTx, clinicId: string) {
		return tx.clinic.findUniqueOrThrow({
			where: { id: clinicId },
			select: {
				name: true,
				birBranchCode: true,
				addressLine: true,
				zipCode: true,
				contactNo: true,
				barangay: { select: { name: true } },
				cityMunicipality: { select: { name: true } },
				organization: { select: { name: true, tradeName: true, tin: true, vatRegistration: true } },
			},
		});
	}

	findSeries(tx: ClinicalTx, id: string) {
		return tx.invoiceSeries.findUnique({ where: { id } });
	}

	/**
	 * Invoices still to settle at the clinic, oldest first: drafts and issued invoices with a balance (`statuses`), with
	 * the visit's patient for the link to its billing tab.
	 */
	listOpen(
		tx: ClinicalTx,
		filter: {
			clinicId: string;
			statuses: readonly ('DRAFT' | 'ISSUED' | 'PARTIALLY_PAID')[];
			patientId?: string;
			limit: number;
		},
	) {
		return tx.invoice.findMany({
			where: {
				clinicId: filter.clinicId,
				status: { in: [...filter.statuses] },
				...(filter.patientId ? { encounter: { patientId: filter.patientId } } : {}),
			},
			select: {
				id: true,
				invoiceNo: true,
				status: true,
				buyerName: true,
				netAmount: true,
				balance: true,
				createdAt: true,
				issuedAt: true,
				encounterId: true,
				encounter: { select: { patientId: true, encounterNo: true } },
			},
			orderBy: { createdAt: 'asc' },
			take: filter.limit,
		});
	}

	/**
	 * Voids the posted payments that settle only this invoice (a payment split over several invoices stays).
	 * Returns their ids.
	 */
	async voidPaymentsOf(
		tx: ClinicalTx,
		invoiceId: string,
		voided: { voidReason: string; voidedById: string; voidedAt: Date },
	): Promise<string[]> {
		const payments = await tx.payment.findMany({
			where: { status: 'POSTED', allocations: { some: { invoiceId }, every: { invoiceId } } },
			select: { id: true },
		});
		const ids = payments.map((payment) => payment.id);
		if (ids.length > 0) {
			await tx.payment.updateMany({ where: { id: { in: ids } }, data: { status: 'VOIDED', ...voided } });
		}
		return ids;
	}
}
