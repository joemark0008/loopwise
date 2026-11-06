import { InvoiceVoidReasonSchema, SplitPaymentSchema } from '@loopwise/shared/invoice';
import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import type { AuditEntry } from '../../audit/audit.types.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import { PaymentExceedsBalanceError, PaymentInClosedShiftError } from '../billing.errors.js';
import type { BillingActor } from '../billing-access.js';
import { dateOnly } from '../billing-dates.js';
import { CashierShiftService } from '../cashier-shifts/cashier-shift.service.js';
import { InvoiceService, parseOrThrow } from '../invoices/invoice.service.js';
import { assertInvoicePaymentReversal, assertInvoiceTransition } from '../invoices/invoice-status.js';
import { type Invoice, toInvoice } from '../invoices/models/invoice.model.js';
import type {
	PaymentTenderInput,
	RecordPaymentInput,
	RecordPaymentsInput,
	VoidPaymentInput,
} from './dto/payment.input.js';
import { PaymentRepository } from './payment.repository.js';
import { assertPaymentTransition } from './payment-status.js';

const ZERO = new Prisma.Decimal(0);

/**
 * Payments at the cashier desk: one or several tenders (split tender: cash, GCash, Maya, QR Ph, cards, bank transfer,
 * check with bank and date, or a PhilHealth package such as Konsulta) on an issued invoice, each a posted payment
 * numbered from the clinic's PAYMENT sequence, allocated to the invoice and attached to the cashier's open shift
 * (refused without one). Together they never exceed the balance; cash tendered gives change. A clinic admin voids a
 * payment with a reason while its shift is open; the invoice's balance comes back.
 */
@Injectable()
export class PaymentService {
	private readonly logger = new Logger(PaymentService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly payments: PaymentRepository,
		private readonly invoices: InvoiceService,
		private readonly shifts: CashierShiftService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** One tender (the form's single payment, or a Wise card's `propose_bill_step`). */
	record(actor: BillingActor, input: RecordPaymentInput): Promise<Invoice> {
		return this.take(actor, {
			invoiceId: input.invoiceId,
			tenders: [input],
			notes: input.notes,
			expectedVersion: input.expectedVersion,
			wiseOrigin: input.wiseOrigin,
		});
	}

	/** Several tenders at once (split tender). */
	recordSplit(actor: BillingActor, input: RecordPaymentsInput): Promise<Invoice> {
		return this.take(actor, input);
	}

	/**
	 * Voids a posted payment with the reason (POSTED → VOIDED, who and when kept): the invoices it paid get their
	 * balance back (PAID → PARTIALLY_PAID / ISSUED). Refused once its shift is closed (the Z reading stands).
	 */
	async void(actor: BillingActor, input: VoidPaymentInput): Promise<Invoice> {
		const voidReason = parseOrThrow(InvoiceVoidReasonSchema, input.reason);
		return this.db.asUser(actor.userId, async (tx) => {
			const payment = await this.payments.findById(tx, input.paymentId);
			if (!payment || payment.clinicId !== actor.clinicId) {
				throw new EntityNotFoundError('Payment', input.paymentId);
			}
			assertPaymentTransition(payment, 'VOIDED');
			if (payment.cashierShiftId && !(await this.shifts.isOpen(tx, payment.cashierShiftId))) {
				throw new PaymentInClosedShiftError(payment.paymentNo);
			}
			const entries: AuditEntry[] = [];
			let firstInvoiceId: string | null = null;
			for (const allocation of payment.allocations) {
				const { invoice, encounter } = await this.invoices.loadForWrite(tx, actor, allocation.invoiceId);
				const amountPaid = Prisma.Decimal.max(ZERO, invoice.amountPaid.minus(allocation.amount));
				const status = amountPaid.isZero() ? 'ISSUED' : 'PARTIALLY_PAID';
				assertInvoicePaymentReversal(invoice, status);
				const row = await this.invoices.updateAtVersion(tx, invoice, null, {
					amountPaid,
					balance: invoice.netAmount.minus(amountPaid),
					status,
				});
				firstInvoiceId ??= row.id;
				const base = this.invoices.auditBase(actor, encounter, row);
				entries.push({
					...base,
					action: 'UPDATE',
					event: 'invoice.payment_void',
					changes: auditChanges(invoice, row, ['status', 'amountPaid', 'balance']),
				});
				if (entries.length === 1) {
					entries.push({
						...base,
						action: 'VOID',
						event: 'payment.void',
						entityType: 'Payment',
						entityId: payment.id,
						reason: voidReason,
						changes: { before: { status: payment.status }, after: { status: 'VOIDED' } },
					});
				}
			}
			const voided = await this.payments.void(tx, payment.id, {
				voidReason,
				voidedAt: new Date(),
				voidedById: actor.userId,
			});
			if (!voided) {
				assertPaymentTransition({ ...payment, status: 'VOIDED' }, 'VOIDED');
			}
			await this.audit.recordMany(tx, entries);
			this.logger.log(`Voided payment ${payment.paymentNo}`);
			return toInvoice(await this.invoices.findOrThrow(tx, firstInvoiceId ?? payment.allocations[0].invoiceId));
		});
	}

	private async take(
		actor: BillingActor,
		input: RecordPaymentsInput & Pick<RecordPaymentInput, 'wiseOrigin'>,
	): Promise<Invoice> {
		const tenders = parseOrThrow(SplitPaymentSchema, input.tenders.map(toDraft));
		const total = tenders.reduce((sum, tender) => sum.plus(tender.amount), ZERO);
		return this.db.asUser(actor.userId, async (tx) => {
			const { invoice, encounter } = await this.invoices.loadForWrite(tx, actor, input.invoiceId);
			const card = await this.wiseProposals.verifyAction(
				actor.userId,
				input.wiseOrigin,
				'recordPayment',
				encounter.clinic.organizationId,
			);
			assertCardPatient(card, encounter.patientId);
			assertInvoiceTransition(invoice, 'PAID');
			if (invoice.balance.lessThan(total)) {
				throw new PaymentExceedsBalanceError(total.toFixed(2), invoice.balance.toFixed(2));
			}
			const cashierShiftId = await this.shifts.requireOpenShift(tx, actor);
			const notes = input.notes?.trim() || null;
			const created = [];
			for (const tender of tenders) {
				created.push(
					await this.payments.create(
						tx,
						{
							paymentNo: await this.sequences.next(tx, encounter.clinic, 'PAYMENT'),
							clinicId: encounter.clinicId,
							cashierShiftId,
							method: tender.method,
							amount: new Prisma.Decimal(tender.amount),
							tenderedAmount: tender.tenderedAmount === undefined ? null : tender.tenderedAmount,
							changeAmount:
								tender.tenderedAmount === undefined
									? null
									: new Prisma.Decimal(tender.tenderedAmount).minus(tender.amount),
							referenceNo: tender.referenceNo ?? null,
							bankName: tender.bankName ?? null,
							checkDate: tender.checkDate ? dateOnly(tender.checkDate) : null,
							notes,
							receivedById: actor.userId,
						},
						invoice.id,
					),
				);
			}
			const row = await this.invoices.applyPayment(tx, invoice, total, input.expectedVersion);
			const base = this.invoices.auditBase(actor, encounter, row, card);
			await this.audit.recordMany(tx, [
				...created.map((payment): AuditEntry => ({
					...base,
					action: 'CREATE',
					event: 'payment.record',
					entityType: 'Payment',
					entityId: payment.id,
					changes: { after: auditSnapshot({ ...payment, invoiceId: invoice.id }) },
				})),
				{
					...base,
					action: 'UPDATE',
					event: 'invoice.payment',
					changes: auditChanges(invoice, row, ['status', 'amountPaid', 'balance']),
				},
			]);
			await this.wiseProposals.settleAction(tx, actor.userId, card, {
				entityType: 'Payment',
				entityId: created[0].id,
			});
			return toInvoice(row);
		});
	}
}

const toDraft = (tender: PaymentTenderInput) => ({
	method: tender.method,
	amount: tender.amount,
	tenderedAmount: tender.tenderedAmount,
	referenceNo: tender.referenceNo,
	bankName: tender.bankName,
	checkDate: tender.checkDate,
});
