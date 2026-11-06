import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import type { InvoiceDocType } from '../../../generated/prisma/client.js';
import { AuditService } from '../../audit/audit.service.js';
import { auditChanges, auditSnapshot } from '../../audit/audit-changes.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import { ClinicalDbService, type ClinicalTx } from '../../rls/clinical-db.service.js';
import {
	InvalidBillingInputError,
	InvoiceSeriesExhaustedError,
	InvoiceSeriesExpiredError,
	InvoiceSeriesOverlapError,
} from '../billing.errors.js';
import type { BillingActor } from '../billing-access.js';
import { dateOnly, manilaDate } from '../billing-dates.js';
import type { CreateInvoiceSeriesInput, UpdateInvoiceSeriesInput } from './dto/invoice-series.input.js';
import { InvoiceSeriesRepository } from './invoice-series.repository.js';
import { formatSeriesNumber, type InvoiceSeries, toInvoiceSeries } from './models/invoice-series.model.js';

const AUDITED = ['prefix', 'startNo', 'endNo', 'permitNo', 'permitDate', 'validUntil', 'isActive'] as const;

/**
 * The clinic's BIR invoice series (ATP or CAS / PTU permit, a numbered range, its validity), managed by the clinic's
 * admins, and the numbering of an invoice on issue: the next number of the first usable series, taken atomically;
 * refused once every series is exhausted or expired. A clinic with no series at all numbers from its INVOICE document
 * sequence (a clinic not yet registered, e.g. the demo before setup).
 */
@Injectable()
export class InvoiceSeriesService {
	private readonly logger = new Logger(InvoiceSeriesService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly series: InvoiceSeriesRepository,
		private readonly sequences: DocumentSequenceService,
		private readonly audit: AuditService,
	) {}

	list(actor: BillingActor): Promise<InvoiceSeries[]> {
		return this.db.asUser(actor.userId, async (tx) => {
			const today = manilaDate();
			return (await this.series.list(tx, actor.clinicId)).map((row) => toInvoiceSeries(row, today));
		});
	}

	async create(actor: BillingActor, input: CreateInvoiceSeriesInput): Promise<InvoiceSeries> {
		if (input.endNo < input.startNo) {
			throw new InvalidBillingInputError('The last number comes before the first.', 'endNo');
		}
		if (input.validUntil && input.validUntil < input.permitDate) {
			throw new InvalidBillingInputError('"Valid until" is before the permit date.', 'validUntil');
		}
		const prefix = input.prefix?.trim() || null;
		const docType: InvoiceDocType = input.docType ?? 'SALES_INVOICE';
		return this.db.asUser(actor.userId, async (tx) => {
			const range = { clinicId: actor.clinicId, docType, prefix, startNo: input.startNo, endNo: input.endNo };
			const overlap = await this.series.findOverlap(tx, range);
			if (overlap) {
				throw new InvoiceSeriesOverlapError(overlap.id);
			}
			const row = await this.series.create(tx, {
				...range,
				nextNo: input.startNo,
				permitNo: input.permitNo.trim(),
				permitDate: dateOnly(input.permitDate),
				validUntil: input.validUntil ? dateOnly(input.validUntil) : null,
				isActive: true,
			});
			await this.audit.created(tx, {
				...this.auditBase(actor, row.id),
				event: 'invoice_series.create',
				changes: { after: auditSnapshot(row) },
			});
			return toInvoiceSeries(row, manilaDate());
		});
	}

	async update(actor: BillingActor, input: UpdateInvoiceSeriesInput): Promise<InvoiceSeries> {
		return this.db.asUser(actor.userId, async (tx) => {
			const current = await this.series.findById(tx, input.id);
			if (!current || current.clinicId !== actor.clinicId) {
				throw new EntityNotFoundError('InvoiceSeries', input.id);
			}
			const validUntil =
				input.validUntil === undefined || input.validUntil === null
					? undefined
					: input.validUntil.trim() === ''
						? null
						: dateOnly(input.validUntil);
			const row = await this.series.update(tx, current.id, {
				...(input.permitNo != null ? { permitNo: input.permitNo.trim() } : {}),
				...(input.permitDate != null ? { permitDate: dateOnly(input.permitDate) } : {}),
				...(validUntil !== undefined ? { validUntil } : {}),
				...(input.isActive != null ? { isActive: input.isActive } : {}),
			});
			await this.audit.updated(tx, {
				...this.auditBase(actor, row.id),
				event: 'invoice_series.update',
				changes: auditChanges(current, row, AUDITED),
			});
			return toInvoiceSeries(row, manilaDate());
		});
	}

	/**
	 * The number an invoice takes on issue, inside the issue's transaction (a rollback gives the number back): the
	 * clinic's series, else its INVOICE document sequence when it has registered none.
	 */
	async takeNumber(
		tx: ClinicalTx,
		clinic: { id: string; code: string },
		docType: InvoiceDocType = 'SALES_INVOICE',
	): Promise<{ invoiceNo: string; seriesId: string | null }> {
		const taken = await this.series.take(tx, clinic.id, docType);
		switch (taken.kind) {
			case 'taken':
				return { invoiceNo: formatSeriesNumber(taken, taken.number), seriesId: taken.seriesId };
			case 'exhausted':
				this.logger.warn(`Invoice series ${taken.seriesId} is exhausted`);
				throw new InvoiceSeriesExhaustedError(taken.seriesId);
			case 'expired':
				this.logger.warn(`Invoice series ${taken.seriesId} has expired`);
				throw new InvoiceSeriesExpiredError(taken.seriesId);
			case 'none':
				return { invoiceNo: await this.sequences.next(tx, clinic, 'INVOICE'), seriesId: null };
		}
	}

	private auditBase(actor: BillingActor, seriesId: string) {
		return { userId: actor.userId, entityType: 'InvoiceSeries', entityId: seriesId, clinicId: actor.clinicId };
	}
}
