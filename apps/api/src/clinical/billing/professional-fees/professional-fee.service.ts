import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { PfStatus, Prisma } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import { InvalidBillingInputError, ProfessionalFeeReleasedError } from '../billing.errors.js';
import type { BillingActor } from '../billing-access.js';
import { manilaDate, manilaDayRange } from '../billing-dates.js';
import { VisitChargesRepository } from '../charges/visit-charges.repository.js';
import type { InvoiceRow } from '../invoices/models/invoice.model.js';
import type { ProfessionalFeeReportInput, ReleaseProfessionalFeesInput } from './dto/professional-fee.input.js';
import { type ProfessionalFeeReport, toProfessionalFeeReport } from './models/professional-fee.model.js';
import { ProfessionalFeeRepository } from './professional-fee.repository.js';
import { professionalFeeAmounts } from './professional-fee-amounts.js';
import { assertPfTransition, pfStatusesInto } from './professional-fee-status.js';

/** The longest period a report covers. */
const MAX_REPORT_DAYS = 366;

/**
 * Doctors' professional fees (BIR 2307: expanded withholding tax on the fee). A fee is created when its invoice is
 * **issued** (not when paid): the fee is earned by the service billed, and the clinic owes it once the sale is
 * recorded, so the PF report matches the issued invoices of a period whatever the collections. One fee per PF line
 * naming a doctor (`invoice_lines.is_professional_fee`); voiding the invoice cancels its unreleased fees (an invoice
 * whose fee was released can't be voided). Admins release fees with a payout reference.
 */
@Injectable()
export class ProfessionalFeeService {
	private readonly logger = new Logger(ProfessionalFeeService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly fees: ProfessionalFeeRepository,
		private readonly charges: VisitChargesRepository,
		private readonly audit: AuditService,
	) {}

	/** Inside the issue's transaction: one fee per PF line of the invoice. Returns how many. */
	async createForIssuedInvoice(tx: ClinicalTx, invoice: InvoiceRow): Promise<number> {
		const rows: Prisma.ProfessionalFeeCreateManyInput[] = [];
		for (const line of invoice.lines) {
			if (!line.isProfessionalFee || !line.practitionerId) {
				continue;
			}
			const terms = await this.charges.findPractitionerTerms(tx, line.practitionerId, invoice.clinicId);
			rows.push({
				practitionerId: line.practitionerId,
				invoiceLineId: line.id,
				encounterId: line.encounterId ?? invoice.encounterId,
				...professionalFeeAmounts(line, terms),
				status: 'UNPAID',
			});
		}
		if (rows.length > 0) {
			await this.fees.createMany(tx, rows);
		}
		return rows.length;
	}

	/** Inside the void's transaction: cancels the invoice's unreleased fees; refuses when one was released. */
	async cancelForVoidedInvoice(tx: ClinicalTx, invoiceId: string): Promise<string[]> {
		const fees = await this.fees.listForInvoice(tx, invoiceId);
		if (fees.some((fee) => fee.status === 'RELEASED')) {
			throw new ProfessionalFeeReleasedError();
		}
		const open = fees.filter((fee) => fee.status !== 'CANCELLED').map((fee) => fee.id);
		if (open.length > 0) {
			await this.fees.setStatus(tx, open, pfStatusesInto('CANCELLED'), { status: 'CANCELLED' });
		}
		return open;
	}

	/** The PF report of the clinic for a period (Manila dates), by doctor; a doctor sees only their own. */
	async report(actor: BillingActor, input: ProfessionalFeeReportInput): Promise<ProfessionalFeeReport> {
		const from = input.from;
		const to = input.to ?? from;
		if (to < from) {
			throw new InvalidBillingInputError('The period ends before it starts.', 'to');
		}
		const range = manilaDayRange(from, to);
		if ((range.lt.getTime() - range.gte.getTime()) / 86_400_000 > MAX_REPORT_DAYS) {
			throw new InvalidBillingInputError('Report at most a year at a time.', 'to');
		}
		return this.db.asUser(actor.userId, async (tx) => {
			const rows = await this.fees.list(tx, {
				clinicId: actor.clinicId,
				from: range.gte,
				to: range.lt,
				practitionerId: input.practitionerId,
				status: (input.status as PfStatus | null | undefined) ?? null,
			});
			await this.audit.view(tx, {
				event: 'professional_fee.report',
				entityType: 'ProfessionalFee',
				userId: actor.userId,
				clinicId: actor.clinicId,
				changes: { after: { from, to, practitionerId: input.practitionerId ?? null, rows: rows.length } },
			});
			return toProfessionalFeeReport(rows, { from, to, generatedOn: manilaDate() });
		});
	}

	/** Releases (pays out) fees of the clinic with the check / transfer reference: UNPAID or FOR_RELEASE → RELEASED. */
	async release(actor: BillingActor, input: ReleaseProfessionalFeesInput): Promise<ProfessionalFeeReport> {
		const releaseRef = input.releaseRef.trim();
		if (releaseRef.length < 2) {
			throw new InvalidBillingInputError('Add the check or transfer reference.', 'releaseRef');
		}
		const ids = [...new Set(input.ids)];
		return this.db.asUser(actor.userId, async (tx) => {
			const rows = await this.fees.findByIds(tx, ids);
			for (const id of ids) {
				const row = rows.find((candidate) => candidate.id === id);
				if (!row || row.invoiceLine?.invoice.clinicId !== actor.clinicId) {
					throw new EntityNotFoundError('ProfessionalFee', id);
				}
				assertPfTransition(row.status, 'RELEASED');
			}
			const releasedAt = new Date();
			await this.fees.setStatus(tx, ids, pfStatusesInto('RELEASED'), {
				status: 'RELEASED',
				releasedAt,
				releaseRef,
				releasedById: actor.userId,
			});
			await this.audit.recordMany(
				tx,
				rows.map((row) => ({
					action: 'UPDATE' as const,
					event: 'professional_fee.release',
					entityType: 'ProfessionalFee',
					entityId: row.id,
					userId: actor.userId,
					clinicId: actor.clinicId,
					changes: {
						before: { status: row.status },
						after: { status: 'RELEASED', releaseRef, netPayable: row.netPayable.toFixed(2) },
					},
				})),
			);
			this.logger.log(`Released ${ids.length} professional fee(s), ref ${releaseRef}`);
			const released = await this.fees.findByIds(tx, ids);
			return toProfessionalFeeReport(released, {
				from: manilaDate(released[0]?.createdAt),
				to: manilaDate(releasedAt),
				generatedOn: manilaDate(releasedAt),
			});
		});
	}
}
