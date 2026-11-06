import { InvoiceDraftSchema, InvoiceVoidReasonSchema } from '@loopwise/shared/invoice';
import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError, StaleVersionError } from '../../../common/errors/domain-error.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges } from '../../audit/audit-changes.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import {
	assertCardPatient,
	type VerifiedWiseCard,
	WiseProposalService,
} from '../../wise-proposals/wise-proposal.service.js';
import { LinePractitionerInvalidError, WrongClinicError } from '../billing.errors.js';
import { type BillingActor, isBillingAdmin } from '../billing-access.js';
import { VisitChargesRepository } from '../charges/visit-charges.repository.js';
import { InvoiceDiscountService } from '../discounts/invoice-discount.service.js';
import { InvoiceSeriesService } from '../invoice-series/invoice-series.service.js';
import { ProfessionalFeeService } from '../professional-fees/professional-fee.service.js';
import type { ResolvedLine } from '../service-items/service-item.service.js';
import { ServiceItemService } from '../service-items/service-item.service.js';
import type { IssueInvoiceInput, SaveInvoiceDraftInput, VoidInvoiceInput } from './dto/invoice.input.js';
import { type BillingEncounter, InvoiceRepository } from './invoice.repository.js';
import { asObject, buyerNameOf, keepBilledMovements, parseOrThrow, toLineRow } from './invoice-helpers.js';
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
	'otherDiscount',
	'withholdingTax',
	'netAmount',
	'amountPaid',
	'balance',
] as const satisfies readonly (keyof InvoiceRow)[];

/**
 * The visit invoice (BIR sales invoice): a draft per visit, edited freely; issuing numbers it from the clinic's BIR
 * series and locks it (and creates the doctors' professional fees); then payments (`PaymentService`) or a void by a
 * clinic admin. One invoice per visit that is not void. Totals are always computed here (`InvoiceTotalsService`), never
 * taken from the client. Every change is one transaction with its audit row.
 */
@Injectable()
export class InvoiceService {
	private readonly logger = new Logger(InvoiceService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoices: InvoiceRepository,
		private readonly totals: InvoiceTotalsService,
		private readonly serviceItems: ServiceItemService,
		private readonly discounts: InvoiceDiscountService,
		private readonly series: InvoiceSeriesService,
		private readonly professionalFees: ProfessionalFeeService,
		private readonly charges: VisitChargesRepository,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/**
	 * Creates the visit's draft invoice, or replaces the draft it has (one invoice per visit that is not void; an
	 * issued one must be voided first). Lines naming a catalog item are billed as it; discounts are checked
	 * (`InvoiceDiscountService`); VAT follows the organization's VAT registration.
	 */
	async saveDraft(actor: BillingActor, input: SaveInvoiceDraftInput): Promise<Invoice> {
		const draft = parseOrThrow(InvoiceDraftSchema, {
			lines: input.lines.map((line) => ({ ...line, taxType: line.taxType ?? undefined })),
			discountType: input.discountType,
			discountIdentificationId: input.discountIdentificationId,
			discountIdNumber: input.discountIdNumber,
			otherDiscountType: input.otherDiscountType,
			otherDiscountPercent: input.otherDiscountPercent,
			otherDiscountAmount: input.otherDiscountAmount,
			otherDiscountApprovedById: input.otherDiscountApprovedById,
			withholdingTaxRate: input.withholdingTaxRate,
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
			const lines = keepBilledMovements(await this.serviceItems.resolveLines(tx, clinic, draft.lines), current);
			await this.assertLinePractitioners(tx, encounter, lines);
			const buyerName = buyerNameOf(encounter);
			const plan = await this.discounts.plan(tx, draft, {
				clinicId: encounter.clinicId,
				patientId: encounter.patientId,
				buyerName,
			});
			const amounts = this.totals.compute(lines, {
				vatRegistered: encounter.clinic.organization.vatRegistration === 'VAT',
				statutoryDiscount: plan.statutory?.type ?? null,
				otherDiscount: plan.other,
				withholdingTaxRate: draft.withholdingTaxRate ?? 0,
			});
			const lineRows = lines.map((line, index) => toLineRow(line, index, encounter, amounts.lines[index]));
			const discountRows = this.discounts.rows(plan, amounts.invoice, actor.userId);
			const fields = { buyerName, ...amounts.invoice };

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
	 * Issues a draft (DRAFT → ISSUED): numbers it from the clinic's BIR series (`InvoiceSeriesService`, refused when
	 * exhausted or expired), opens its balance and creates the doctors' professional fees. From here the
	 * `invoices_lock` trigger lets only payments and a void change it (EOPT Act, RA 11976).
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
			const number = await this.series.takeNumber(tx, encounter.clinic, invoice.docType);
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
			const fees = await this.professionalFees.createForIssuedInvoice(tx, row);
			const changes = auditChanges(invoice, row, AUDITED_FIELDS);
			await this.audit.updated(tx, {
				...this.auditBase(actor, encounter, row, card),
				event: 'invoice.issue',
				changes: {
					before: changes?.before ?? null,
					after: { ...asObject(changes?.after), professionalFees: fees },
				},
			});
			await this.wiseProposals.settleAction(tx, actor.userId, card, { entityType: 'Invoice', entityId: row.id });
			this.logger.log(`Issued invoice ${row.invoiceNo}`);
			return toInvoice(row);
		});
	}

	/**
	 * Voids an invoice at any status but VOID, with the reason; clinic admins only. The number stays used (BIR: a void
	 * invoice is kept, marked void, with who and why). Payments that settle only this invoice are voided with it and
	 * its unreleased professional fees cancelled; a new invoice can then be drafted for the visit.
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
			const cancelledFeeIds = await this.professionalFees.cancelForVoidedInvoice(tx, invoice.id);
			const voidedAt = new Date();
			await this.updateAtVersion(tx, invoice, input.expectedVersion, {
				status: 'VOID',
				voidedAt,
				voidedById: actor.userId,
				voidReason,
			});
			const voidedPaymentIds = await this.invoices.voidPaymentsOf(tx, invoice.id, {
				voidReason,
				voidedById: actor.userId,
				voidedAt,
			});
			const row = await this.findOrThrow(tx, invoice.id);
			await this.audit.record(tx, {
				...this.auditBase(actor, encounter, row, card),
				action: 'VOID',
				event: 'invoice.void',
				reason: voidReason,
				changes: {
					before: { status: invoice.status, invoiceNo: invoice.invoiceNo },
					after: { status: row.status, voidedPaymentIds, cancelledFeeIds },
				},
			});
			await this.wiseProposals.settleAction(tx, actor.userId, card, { entityType: 'Invoice', entityId: row.id });
			return toInvoice(row);
		});
	}

	/**
	 * Applies posted payments to an issued invoice (inside the payment's transaction): amount paid and balance move,
	 * and the status becomes PARTIALLY_PAID or PAID from the balance.
	 */
	async applyPayment(
		tx: ClinicalTx,
		invoice: InvoiceRow,
		amount: Prisma.Decimal,
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
	 * visit must be at the clinic the user is working in. A clinic admin may act on an invoice of their clinic whose
	 * patient they don't see (a void): the visit's header is then read as system work.
	 */
	async loadForWrite(tx: ClinicalTx, actor: BillingActor, id: string): Promise<InvoiceForWrite> {
		const invoice = await this.findOrThrow(tx, id);
		if (!invoice.encounterId) {
			throw new EntityNotFoundError('Encounter');
		}
		const visible = await this.invoices.findEncounter(tx, invoice.encounterId);
		if (!visible && isBillingAdmin(actor) && invoice.clinicId === actor.clinicId) {
			const encounterId = invoice.encounterId;
			const encounter = await this.db.asSystem((system) => this.invoices.findEncounter(system, encounterId));
			if (encounter) {
				return { invoice, encounter };
			}
		}
		return { invoice, encounter: await this.encounterForWrite(tx, actor, invoice.encounterId, visible) };
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

	/** The visit for a billing write: visible to the user, and at the clinic they are working in. */
	async encounterForWrite(
		tx: ClinicalTx,
		actor: BillingActor,
		encounterId: string,
		found?: BillingEncounter | null,
	): Promise<BillingEncounter> {
		const encounter = found === undefined ? await this.invoices.findEncounter(tx, encounterId) : found;
		if (!encounter) {
			throw new EntityNotFoundError('Encounter', encounterId);
		}
		if (encounter.clinicId !== actor.clinicId) {
			throw new WrongClinicError();
		}
		return encounter;
	}

	async findOrThrow(tx: ClinicalTx, id: string): Promise<InvoiceRow> {
		const invoice = await this.invoices.findById(tx, id);
		if (!invoice) {
			throw new EntityNotFoundError('Invoice', id);
		}
		return invoice;
	}

	async updateAtVersion(
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

	/** A line naming a doctor names one of the clinic's (the visit's doctor always passes). */
	private async assertLinePractitioners(
		tx: ClinicalTx,
		encounter: BillingEncounter,
		lines: readonly ResolvedLine[],
	): Promise<void> {
		const named = [
			...new Set(
				lines.flatMap((line) =>
					line.practitionerId && line.practitionerId !== encounter.practitionerId
						? [line.practitionerId]
						: [],
				),
			),
		];
		const atClinic = await this.charges.practitionersAt(tx, encounter.clinicId, named);
		const stranger = named.find((id) => !atClinic.has(id));
		if (stranger) {
			throw new LinePractitionerInvalidError(stranger);
		}
	}
}

export { buyerNameOf, parseOrThrow };
