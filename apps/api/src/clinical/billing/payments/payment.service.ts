import { changeDue, PaymentDraftSchema } from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import { PaymentExceedsBalanceError } from '../billing.errors.js';
import type { BillingActor } from '../billing-access.js';
import { InvoiceService, parseOrThrow } from '../invoices/invoice.service.js';
import { assertInvoiceTransition } from '../invoices/invoice-status.js';
import { type Invoice, toInvoice } from '../invoices/models/invoice.model.js';
import type { RecordPaymentInput } from './dto/payment.input.js';
import { PaymentRepository } from './payment.repository.js';

/**
 * Payments at the cashier desk: one posted payment (cash with the official receipt number, e-wallet, card, or a
 * PhilHealth package such as Konsulta, which PhilHealth pays) allocated to an issued invoice. It never exceeds the
 * balance; cash tendered gives change. Numbered from the clinic's PAYMENT sequence.
 */
@Injectable()
export class PaymentService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly payments: PaymentRepository,
		private readonly invoices: InvoiceService,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/**
	 * Records a payment against an issued (or partially paid) invoice and moves it to PARTIALLY_PAID or PAID from the
	 * balance, in one transaction with both audit rows.
	 */
	async record(actor: BillingActor, input: RecordPaymentInput): Promise<Invoice> {
		const draft = parseOrThrow(PaymentDraftSchema, {
			method: input.method,
			amount: input.amount,
			tenderedAmount: input.tenderedAmount,
			referenceNo: input.referenceNo,
		});
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
			if (invoice.balance.lessThan(draft.amount)) {
				throw new PaymentExceedsBalanceError(draft.amount, invoice.balance.toNumber());
			}
			const payment = await this.payments.create(
				tx,
				{
					paymentNo: await this.sequences.next(tx, encounter.clinic, 'PAYMENT'),
					clinicId: encounter.clinicId,
					method: draft.method,
					amount: draft.amount,
					tenderedAmount: draft.tenderedAmount ?? null,
					changeAmount:
						draft.tenderedAmount === undefined ? null : changeDue(draft.amount, draft.tenderedAmount),
					referenceNo: draft.referenceNo,
					notes: input.notes?.trim() || null,
					receivedById: actor.userId,
				},
				invoice.id,
			);
			const row = await this.invoices.applyPayment(tx, invoice, draft.amount, input.expectedVersion);
			const base = this.invoices.auditBase(actor, encounter, row, card);
			await this.audit.recordMany(tx, [
				{
					...base,
					action: 'CREATE',
					event: 'payment.record',
					entityType: 'Payment',
					entityId: payment.id,
					changes: { after: auditSnapshot({ ...payment, invoiceId: invoice.id }) },
				},
				{
					...base,
					action: 'UPDATE',
					event: 'invoice.payment',
					changes: auditChanges(invoice, row, ['status', 'amountPaid', 'balance']),
				},
			]);
			await this.wiseProposals.settleAction(tx, actor.userId, card, {
				entityType: 'Payment',
				entityId: payment.id,
			});
			return toInvoice(row);
		});
	}
}
