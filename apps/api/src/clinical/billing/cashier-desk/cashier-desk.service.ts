import type { listBilling } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { ClinicalAccessDeniedError } from '../../../common/errors/domain-error.js';
import { AccessService } from '../../../common/guards/access.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { InvalidBillingInputError } from '../billing.errors.js';
import { type BillingActor, holdsBillingRole, INVOICE_COLLECT_ROLES } from '../billing-access.js';
import { manilaDate, manilaDayRange } from '../billing-dates.js';
import { CashierShiftRepository } from '../cashier-shifts/cashier-shift.repository.js';
import { toCashierShift } from '../cashier-shifts/models/cashier-shift.model.js';
import { InvoiceRepository } from '../invoices/invoice.repository.js';
import { PaymentRepository } from '../payments/payment.repository.js';
import type { CashierDesk, OpenInvoice } from './models/cashier-desk.model.js';

const OPEN_LIMIT = 50;
const ISSUED_OPEN = ['ISSUED', 'PARTIALLY_PAID'] as const;

/**
 * The cashier desk's reads at the clinic, as the user (row-level security) and audited: the day's collections by
 * method, the invoices still to settle (linking to each visit's billing tab), and the user's shift. The same reads
 * back Wise's `list_billing` tool (DESIGN.md §7.2); nothing here writes but the audit row.
 */
@Injectable()
export class CashierDeskService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoices: InvoiceRepository,
		private readonly payments: PaymentRepository,
		private readonly shifts: CashierShiftRepository,
		private readonly access: AccessService,
		private readonly audit: AuditService,
	) {}

	async desk(actor: BillingActor, date?: string | null): Promise<CashierDesk> {
		const day = checkDate(date);
		return this.db.asUser(actor.userId, async (tx) => {
			const collections = await this.payments.collectionsByMethod(tx, actor.clinicId, manilaDayRange(day));
			const open = await this.invoices.listOpen(tx, {
				clinicId: actor.clinicId,
				statuses: ['DRAFT', ...ISSUED_OPEN],
				limit: OPEN_LIMIT,
			});
			const shift = await this.shifts.findOpen(tx, actor.clinicId, actor.userId);
			await this.audit.view(tx, {
				event: 'cashier_desk.view',
				entityType: 'Payment',
				userId: actor.userId,
				clinicId: actor.clinicId,
				changes: { after: { date: day, openInvoices: open.length } },
			});
			return {
				date: day,
				collections: collections.map((total) => ({ ...total, amount: total.amount.toNumber() })),
				totalCollected: sum(collections.map((total) => total.amount)).toNumber(),
				openInvoices: open.map(toOpenInvoice),
				myShift: shift ? toCashierShift(shift, await this.shifts.methodTotals(tx, shift.id)) : null,
			};
		});
	}

	/** `list_billing`: one view of the desk for Wise, at the chat's clinic. */
	async forWise(
		userId: string,
		clinicId: string | null,
		input: listBilling.Input & { chartPatientId?: string | null },
	): Promise<Omit<listBilling.Output, '_version'>> {
		if (!clinicId) {
			throw new InvalidBillingInputError('This chat has no clinic. Open Wise from one of your clinics.');
		}
		const grant = (await this.access.listUserClinics(userId)).find(
			(candidate) => candidate.clinic.id === clinicId && candidate.userRole !== 'viewer',
		);
		if (!grant) {
			throw new ClinicalAccessDeniedError('You do not work at this clinic.');
		}
		const actor: BillingActor = { userId, clinicId, userRole: grant.userRole, staffRoles: grant.staffRoles };
		const base = { view: input.view, clinicName: grant.clinic.name };
		return this.db.asUser(userId, async (tx) => {
			const audited = (event: string, details: Prisma.InputJsonObject, patientId?: string | null) =>
				this.audit.view(tx, {
					event,
					entityType: 'Invoice',
					userId,
					clinicId,
					patientId: patientId ?? null,
					organizationId: grant.clinic.organizationId,
					reason: 'Wise list_billing',
					changes: { after: details },
				});
			if (input.view === 'collections') {
				this.requireDesk(actor);
				const day = checkDate(input.date);
				const collections = await this.payments.collectionsByMethod(tx, clinicId, manilaDayRange(day));
				await audited('payment.collections', { date: day });
				return {
					...base,
					date: day,
					collections: collections.map((total) => ({ ...total, amount: total.amount.toNumber() })),
					totalCollected: sum(collections.map((total) => total.amount)).toNumber(),
				};
			}
			if (input.view === 'shift') {
				this.requireDesk(actor);
				return { ...base, date: manilaDate(), shift: await this.shiftForWise(tx, actor) };
			}
			const patientId = input.patientId?.trim() || input.chartPatientId || null;
			if (!patientId) {
				this.requireDesk(actor);
			}
			const open = await this.invoices.listOpen(tx, {
				clinicId,
				statuses: patientId ? ['DRAFT', ...ISSUED_OPEN] : [...ISSUED_OPEN],
				patientId: patientId ?? undefined,
				limit: OPEN_LIMIT,
			});
			await audited('invoice.list', { open: open.length }, patientId);
			return {
				...base,
				date: manilaDate(),
				openInvoices: open.map((row) => {
					const invoice = toOpenInvoice(row);
					return {
						invoiceNo: invoice.invoiceNo,
						status: invoice.status,
						buyerName: invoice.buyerName,
						netAmount: invoice.netAmount,
						balance: invoice.balance,
						createdAt: invoice.createdAt.toISOString(),
						patientId: invoice.patientId,
						encounterId: invoice.encounterId,
					};
				}),
			};
		});
	}

	private async shiftForWise(tx: ClinicalTx, actor: BillingActor): Promise<listBilling.Output['shift']> {
		const row = await this.shifts.findOpen(tx, actor.clinicId, actor.userId);
		if (!row) {
			return null;
		}
		const shift = toCashierShift(row, await this.shifts.methodTotals(tx, row.id));
		await this.audit.view(tx, {
			event: 'cashier_shift.x_reading',
			entityType: 'CashierShift',
			entityId: row.id,
			userId: actor.userId,
			clinicId: actor.clinicId,
			reason: 'Wise list_billing',
		});
		return {
			openedAt: shift.openedAt.toISOString(),
			openingCash: shift.openingCash,
			byMethod: shift.byMethod,
			totalCollected: shift.totalCollected,
			cashCollected: shift.cashCollected,
			expectedCash: shift.expectedCash,
			paymentCount: shift.paymentCount,
		};
	}

	/** The clinic-wide views are the billing desk's (and admins'). */
	private requireDesk(actor: BillingActor): void {
		if (!holdsBillingRole(actor, INVOICE_COLLECT_ROLES)) {
			throw new ClinicalAccessDeniedError("The cashier desk's figures are for the cashier, billing and admins.");
		}
	}
}

function checkDate(date?: string | null): string {
	const day = date?.trim() || manilaDate();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
		throw new InvalidBillingInputError(`"${day}" isn't a date: use YYYY-MM-DD.`, 'date');
	}
	return day;
}

const sum = (values: readonly Prisma.Decimal[]) =>
	values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));

function toOpenInvoice(row: Awaited<ReturnType<InvoiceRepository['listOpen']>>[number]): OpenInvoice {
	return {
		id: row.id,
		invoiceNo: row.invoiceNo,
		status: row.status,
		buyerName: row.buyerName,
		netAmount: row.netAmount.toNumber(),
		balance: row.status === 'DRAFT' ? row.netAmount.toNumber() : row.balance.toNumber(),
		createdAt: row.createdAt,
		encounterId: row.encounterId,
		patientId: row.encounter?.patientId ?? null,
		encounterNo: row.encounter?.encounterNo ?? null,
	};
}
