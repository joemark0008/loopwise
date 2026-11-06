import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import type { BillingActor } from '../billing-access.js';
import { formatSeriesNumber } from '../invoice-series/models/invoice-series.model.js';
import { InvoiceRepository } from './invoice.repository.js';
import { InvoiceService } from './invoice.service.js';
import { toInvoice } from './models/invoice.model.js';
import type { PrintableInvoice } from './models/printable-invoice.model.js';

const isoDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/**
 * The printed BIR sales invoice (RR 7-2024 / EOPT Act): the seller's registered and trade names, TIN, VAT or non-VAT
 * status and address, the clinic's branch code, the number, date and buyer, the lines, the VAT breakdown, the SC/PWD
 * details, and the ATP / CAS permit of the series. Only issued invoices print; each print is audited.
 */
@Injectable()
export class InvoicePrintService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoices: InvoiceService,
		private readonly rows: InvoiceRepository,
		private readonly audit: AuditService,
	) {}

	get(actor: BillingActor, invoiceId: string): Promise<PrintableInvoice> {
		return this.db.asUser(actor.userId, async (tx) => {
			const { invoice, encounter } = await this.invoices.loadForWrite(tx, actor, invoiceId);
			if (invoice.status === 'DRAFT') {
				throw new EntityNotFoundError('Invoice', invoiceId);
			}
			const seller = await this.rows.findSeller(tx, invoice.clinicId);
			const series = invoice.seriesId ? await this.rows.findSeries(tx, invoice.seriesId) : null;
			await this.audit.record(tx, {
				...this.invoices.auditBase(actor, encounter, invoice),
				action: 'PRINT',
				event: 'invoice.print',
			});
			const address = [
				seller.addressLine,
				seller.barangay?.name,
				seller.cityMunicipality?.name,
				seller.zipCode,
			].filter(Boolean);
			return {
				invoice: toInvoice(invoice),
				seller: {
					registeredName: seller.organization.name,
					tradeName: seller.organization.tradeName,
					tin: seller.organization.tin,
					vatRegistered: seller.organization.vatRegistration === 'VAT',
					birBranchCode: seller.birBranchCode,
					clinicName: seller.name,
					address: address.length > 0 ? address.join(', ') : null,
					contactNo: seller.contactNo,
				},
				permit: series
					? {
							permitNo: series.permitNo,
							permitDate: isoDate(series.permitDate),
							validUntil: isoDate(series.validUntil),
							range: `${formatSeriesNumber(series, series.startNo)} – ${formatSeriesNumber(series, series.endNo)}`,
						}
					: null,
				buyerTin: invoice.buyerTin,
				buyerAddress: invoice.buyerAddress,
			};
		});
	}
}
