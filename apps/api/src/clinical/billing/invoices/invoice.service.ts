import {
	DISCOUNT_ID_TYPES,
	type InvoiceDraft,
	InvoiceDraftSchema,
	InvoiceVoidReasonSchema,
	type StatutoryDiscountType,
} from '@loopwise/shared/invoice';
import { Injectable, Logger } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod/v3';

import { EntityNotFoundError, StaleVersionError } from '../../../common/errors/domain-error.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import {
	assertCardPatient,
	type VerifiedWiseCard,
	WiseProposalService,
} from '../../wise-proposals/wise-proposal.service.js';
import { InvalidBillingInputError, InvoiceSeriesExhaustedError, WrongClinicError } from '../billing.errors.js';
import type { BillingActor } from '../billing-access.js';
import type { ResolvedLine } from '../service-items/service-item.service.js';
import { ServiceItemService } from '../service-items/service-item.service.js';
import type { IssueInvoiceInput, SaveInvoiceDraftInput, VoidInvoiceInput } from './dto/invoice.input.js';
import {
	type BillingEncounter,
	type InvoiceDiscountData,
	type InvoiceLineData,
	InvoiceRepository,
} from './invoice.repository.js';
import { assertInvoiceEditable, assertInvoiceTransition } from './invoice-status.js';
import { InvoiceTotalsService } from './invoice-totals.service.js';
import { type Invoice, type InvoiceRow, toInvoice } from './models/invoice.model.js';

/** An invoice loaded for a change, with the visit it bills. */
export interface InvoiceForWrite {
	invoice: InvoiceRow;
	encounter: BillingEncounter;
}

/** The totals an audit row shows for an invoice. */
const AUDITED_FIELDS = [
	'status',
	'invoiceNo',
	'grossAmount',
	'scPwdDiscount',
	'netAmount',
	'amountPaid',
	'balance',
] as const satisfies readonly (keyof InvoiceRow)[];

/**
 * The visit invoice (BIR sales invoice): a draft per visit, edited freely; issuing numbers and locks it; then payments
 * (`PaymentService`) or a void. One invoice per visit that is not void. Totals are always computed here
 * (`InvoiceTotalsService`), never taken from the client. Every change is one transaction with its audit row.
 */
@Injectable()
export class InvoiceService {
	private readonly logger = new Logger(InvoiceService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoices: InvoiceRepository,
		private readonly totals: InvoiceTotalsService,
		private readonly serviceItems: ServiceItemService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/**
	 * Creates the visit's draft invoice, or replaces the draft it has (one invoice per visit that is not void; an
	 * issued one must be voided first). Lines naming a catalog item are billed as it; a senior citizen / PWD discount
	 * (RA 9994 / RA 10754) needs the ID number presented, linked to the patient's ID on file when it matches.
	 */
	async saveDraft(actor: BillingActor, input: SaveInvoiceDraftInput): Promise<Invoice> {
		const draft = parseOrThrow(InvoiceDraftSchema, {
			lines: input.lines.map((line) => ({ ...line, taxType: line.taxType ?? undefined })),
			discountType: input.discountType,
			discountIdNumber: input.discountIdNumber,
		});
		return this.db.asUser(actor.userId, async (tx) => {
			const encounter = await this.encounterForWrite(tx, actor, input.encounterId);
			const card = input.wiseOrigin
				? await this.wiseProposals.verify(actor.userId, input.wiseOrigin, {
						toolNames: ['propose_charges'],
						organizationId: encounter.clinic.organizationId,
					})
				: undefined;
			assertCardPatient(card, encounter.patientId);
			await this.invoices.lockEncounter(tx, encounter.id);
			const current = await this.invoices.findActiveForEncounter(tx, encounter.id);
			if (current) {
				assertInvoiceEditable(current);
			}
			// A card drafted a new invoice or a change to the draft it showed; a draft made or dropped since is stale.
			if (card && Boolean(current) !== (input.expectedVersion != null)) {
				throw new StaleVersionError('Invoice', input.expectedVersion ?? 0, current?.version);
			}
			const clinic = { id: encounter.clinic.id, organizationId: encounter.clinic.organizationId };
			const lines = await this.serviceItems.resolveLines(tx, clinic, draft.lines);
			const discountType = draft.discountType ?? null;
			const amounts = this.totals.compute(lines, discountType);
			const lineRows = lines.map((line, index) => toLineRow(line, index, encounter, amounts.lines[index]));
			const discountRows = amounts.discount
				? [await this.discountRow(tx, encounter, draft, amounts.discount)]
				: [];
			const fields = { buyerName: buyerName(encounter), ...amounts.invoice };

			let row: InvoiceRow;
			if (current) {
				const expected = input.expectedVersion ?? current.version;
				const replaced = await this.invoices.replaceDraft(
					tx,
					current.id,
					expected,
					fields,
					lineRows,
					discountRows,
				);
				if (!replaced) {
					throw new StaleVersionError('Invoice', expected, current.version);
				}
				row = replaced;
				await this.audit.updated(tx, {
					...this.auditBase(actor, encounter, row, card),
					event: 'invoice.update',
					changes: auditChanges(current, row, [...AUDITED_FIELDS, 'buyerName']),
				});
			} else {
				row = await this.invoices.createDraft(
					tx,
					{ ...fields, clinicId: encounter.clinicId, encounterId: encounter.id, createdById: actor.userId },
					lineRows,
					discountRows,
				);
				await this.audit.created(tx, {
					...this.auditBase(actor, encounter, row, card),
					event: 'invoice.create',
					changes: auditChanges(null, row, AUDITED_FIELDS),
				});
			}
			if (card) {
				await this.wiseProposals.settle(tx, actor.userId, card, { entityType: 'Invoice', entityId: row.id });
			}
			return toInvoice(row);
		});
	}

	/**
	 * Issues a draft (DRAFT → ISSUED): numbers it from the clinic's active BIR invoice series (ATP / CAS permit), else
	 * the clinic's INVOICE document sequence, and opens its balance. From here the `invoices_lock` trigger lets only
	 * payments and a void change it (EOPT Act, RA 11976: an issued sales invoice is never edited).
	 */
	async issue(actor: BillingActor, input: IssueInvoiceInput): Promise<Invoice> {
		return this.db.asUser(actor.userId, async (tx) => {
			const { invoice, encounter } = await this.loadForWrite(tx, actor, input.id);
			const card = await this.wiseProposals.verifyAction(
				actor.userId,
				input.wiseOrigin,
				'issueInvoice',
				encounter.clinic.organizationId,
			);
			assertCardPatient(card, encounter.patientId);
			assertInvoiceTransition(invoice, 'ISSUED');
			const number = await this.takeNumber(tx, encounter);
			const now = new Date();
			let row = await this.updateAtVersion(tx, invoice, input.expectedVersion, {
				status: 'ISSUED',
				invoiceNo: number.invoiceNo,
				seriesId: number.seriesId,
				invoiceDate: now,
				issuedAt: now,
				amountPaid: 0,
				balance: invoice.netAmount,
			});
			if (row.netAmount.isZero()) {
				// Nothing due (fully discounted): settled on issue.
				assertInvoiceTransition(row, 'PAID');
				row = await this.updateAtVersion(tx, row, row.version, { status: 'PAID' });
			}
			await this.audit.updated(tx, {
				...this.auditBase(actor, encounter, row, card),
				event: 'invoice.issue',
				changes: auditChanges(invoice, row, AUDITED_FIELDS),
			});
			await this.wiseProposals.settleAction(tx, actor.userId, card, { entityType: 'Invoice', entityId: row.id });
			this.logger.log(`Issued invoice ${row.invoiceNo}`);
			return toInvoice(row);
		});
	}

	/**
	 * Voids an invoice at any status but VOID, with the reason (BIR: a void invoice is kept, marked void). Payments
	 * that settle only this invoice are voided with it; a new invoice can then be drafted for the visit.
	 */
	async void(actor: BillingActor, input: VoidInvoiceInput): Promise<Invoice> {
		const voidReason = parseOrThrow(InvoiceVoidReasonSchema, input.reason);
		return this.db.asUser(actor.userId, async (tx) => {
			const { invoice, encounter } = await this.loadForWrite(tx, actor, input.id);
			const card = await this.wiseProposals.verifyAction(
				actor.userId,
				input.wiseOrigin,
				'voidInvoice',
				encounter.clinic.organizationId,
			);
			assertCardPatient(card, encounter.patientId);
			assertInvoiceTransition(invoice, 'VOID');
			await this.updateAtVersion(tx, invoice, input.expectedVersion, {
				status: 'VOID',
				voidedAt: new Date(),
				voidedById: actor.userId,
				voidReason,
			});
			const voidedPaymentIds = await this.invoices.voidPaymentsOf(tx, invoice.id, voidReason);
			const row = await this.findOrThrow(tx, invoice.id);
			await this.audit.record(tx, {
				...this.auditBase(actor, encounter, row, card),
				action: 'VOID',
				event: 'invoice.void',
				reason: voidReason,
				changes: {
					before: { status: invoice.status },
					after: { status: row.status, voidedPaymentIds },
				},
			});
			await this.wiseProposals.settleAction(tx, actor.userId, card, { entityType: 'Invoice', entityId: row.id });
			return toInvoice(row);
		});
	}

	/**
	 * Applies a posted payment to an issued invoice (inside the payment's transaction): amount paid and balance move,
	 * and the status becomes PARTIALLY_PAID or PAID from the balance.
	 */
	async applyPayment(
		tx: ClinicalTx,
		invoice: InvoiceRow,
		amount: number,
		expectedVersion?: number | null,
	): Promise<InvoiceRow> {
		const amountPaid = invoice.amountPaid.plus(amount);
		const balance = invoice.netAmount.minus(amountPaid);
		const status = balance.lte(0) ? 'PAID' : 'PARTIALLY_PAID';
		assertInvoiceTransition(invoice, status);
		return this.updateAtVersion(tx, invoice, expectedVersion, {
			amountPaid,
			balance: balance.lte(0) ? 0 : balance,
			status,
		});
	}

	/**
	 * The invoice and its visit, for a change by `actor`: it must exist and be visible (row-level security), and the
	 * visit must be at the clinic the user is working in.
	 */
	async loadForWrite(tx: ClinicalTx, actor: BillingActor, id: string): Promise<InvoiceForWrite> {
		const invoice = await this.findOrThrow(tx, id);
		if (!invoice.encounterId) {
			throw new EntityNotFoundError('Encounter');
		}
		const encounter = await this.encounterForWrite(tx, actor, invoice.encounterId);
		return { invoice, encounter };
	}

	/** The fields of an audit row about `invoice` at `encounter`. */
	auditBase(actor: BillingActor, encounter: BillingEncounter, invoice: InvoiceRow, card?: VerifiedWiseCard) {
		return {
			userId: actor.userId,
			entityType: 'Invoice',
			entityId: invoice.id,
			patientId: encounter.patientId,
			clinicId: encounter.clinicId,
			organizationId: encounter.clinic.organizationId,
			origin: card?.origin ?? null,
		};
	}

	private async encounterForWrite(tx: ClinicalTx, actor: BillingActor, encounterId: string) {
		const encounter = await this.invoices.findEncounter(tx, encounterId);
		if (!encounter) {
			throw new EntityNotFoundError('Encounter', encounterId);
		}
		if (encounter.clinicId !== actor.clinicId) {
			throw new WrongClinicError();
		}
		return encounter;
	}

	private async findOrThrow(tx: ClinicalTx, id: string): Promise<InvoiceRow> {
		const invoice = await this.invoices.findById(tx, id);
		if (!invoice) {
			throw new EntityNotFoundError('Invoice', id);
		}
		return invoice;
	}

	private async updateAtVersion(
		tx: ClinicalTx,
		invoice: InvoiceRow,
		expectedVersion: number | null | undefined,
		data: Prisma.InvoiceUncheckedUpdateManyInput,
	): Promise<InvoiceRow> {
		const expected = expectedVersion ?? invoice.version;
		const row = await this.invoices.updateAtVersion(tx, invoice.id, expected, data);
		if (!row) {
			throw new StaleVersionError('Invoice', expected, invoice.version);
		}
		return row;
	}

	private async takeNumber(
		tx: ClinicalTx,
		encounter: BillingEncounter,
	): Promise<{ invoiceNo: string; seriesId: string | null }> {
		const series = await this.invoices.takeSeriesNumber(tx, encounter.clinicId, 'SALES_INVOICE');
		if (series && 'exhausted' in series) {
			throw new InvoiceSeriesExhaustedError(series.exhausted);
		}
		if (series) {
			return series;
		}
		return { invoiceNo: await this.sequences.next(tx, encounter.clinic, 'INVOICE'), seriesId: null };
	}

	/** The `InvoiceDiscount` of a senior citizen / PWD: the beneficiary and the ID presented, linked when on file. */
	private async discountRow(
		tx: ClinicalTx,
		encounter: BillingEncounter,
		draft: InvoiceDraft,
		discount: { type: StatutoryDiscountType; rate: number; amount: number; vatExempted: number },
	): Promise<InvoiceDiscountData> {
		const idNumber = draft.discountIdNumber ?? '';
		const identification = await this.invoices.findIdentification(
			tx,
			encounter.patientId,
			DISCOUNT_ID_TYPES[discount.type],
			idNumber,
		);
		return {
			type: discount.type,
			rate: discount.rate,
			amount: discount.amount,
			vatExempted: discount.vatExempted,
			beneficiaryName: buyerName(encounter),
			idNumber,
			identificationId: identification?.id ?? null,
			invoiceLineId: null,
		};
	}
}

/** The patient as printed on the invoice (and as SC/PWD beneficiary). */
function buyerName(encounter: BillingEncounter): string {
	const { firstName, middleName, lastName, suffix } = encounter.patient;
	return [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
}

function toLineRow(
	line: ResolvedLine,
	index: number,
	encounter: BillingEncounter,
	amounts: { vatAmount: number; discountAmount: number; lineTotal: number },
): InvoiceLineData {
	const category = line.item?.category;
	const isProfessionalFee = category === 'PROFESSIONAL_FEE';
	return {
		serviceItemId: line.serviceItemId,
		encounterId: encounter.id,
		// Whose fee: the visit's doctor for the consultation and professional fees.
		practitionerId: isProfessionalFee || category === 'CONSULTATION' ? encounter.practitionerId : null,
		description: line.description,
		quantity: line.quantity,
		unitPrice: line.unitPrice,
		taxType: line.taxType,
		isProfessionalFee,
		sortOrder: index,
		...amounts,
	};
}

/** Parses with a shared schema; the first problem becomes a BAD_REQUEST the user can act on. */
export function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		const issue = result.error.issues[0];
		throw new InvalidBillingInputError(issue.message, issue.path.join('.') || undefined);
	}
	return result.data;
}
