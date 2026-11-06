import { Injectable } from '@nestjs/common';

import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { InvalidBillingInputError } from '../billing.errors.js';
import type { BillingActor } from '../billing-access.js';
import type {
	InvoiceLineInput,
	LoadInvoiceChargesInput,
	SaveInvoiceDraftInput,
} from '../invoices/dto/invoice.input.js';
import { InvoiceRepository } from '../invoices/invoice.repository.js';
import { InvoiceService } from '../invoices/invoice.service.js';
import { assertInvoiceEditable } from '../invoices/invoice-status.js';
import type { Invoice, InvoiceRow } from '../invoices/models/invoice.model.js';
import { ServiceItemService } from '../service-items/service-item.service.js';
import { type ChargeLine, VisitChargesService } from './visit-charges.service.js';

/**
 * "Load charges" on the visit's invoice: rebuilds the draft's lines from the visit (`VisitChargesService`: the
 * consultation, the tests ordered, the medicines dispensed), keeps the lines the desk added by hand that the visit
 * doesn't charge, and keeps the draft's discounts and withholding. Saved through `InvoiceService.saveDraft`, so the
 * same checks, totals and audit apply; the draft's version guards against a change made in between.
 */
@Injectable()
export class InvoiceChargesService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoiceRows: InvoiceRepository,
		private readonly invoices: InvoiceService,
		private readonly serviceItems: ServiceItemService,
		private readonly visitCharges: VisitChargesService,
	) {}

	async load(actor: BillingActor, input: LoadInvoiceChargesInput): Promise<Invoice> {
		const { charges, current } = await this.db.asUser(actor.userId, async (tx) => {
			const encounter = await this.invoices.encounterForWrite(tx, actor, input.encounterId);
			const priceList = await this.serviceItems.priceList(tx, {
				id: encounter.clinic.id,
				organizationId: encounter.clinic.organizationId,
			});
			const active = await this.invoiceRows.findActiveForEncounter(tx, encounter.id);
			if (active) {
				assertInvoiceEditable(active);
			}
			return {
				charges: await this.visitCharges.chargesFor(tx, actor.userId, encounter, priceList, {
					draftInvoiceId: active?.id ?? null,
				}),
				current: active,
			};
		});
		const lines = mergeLines(charges, current);
		if (lines.length === 0) {
			throw new InvalidBillingInputError('This visit has nothing to charge yet. Add a line by hand.');
		}
		return this.invoices.saveDraft(actor, {
			encounterId: input.encounterId,
			lines,
			...discountFieldsOf(current),
			expectedVersion: input.expectedVersion ?? current?.version ?? null,
		});
	}
}

/** The visit's charges, then the draft's hand-added lines the visit doesn't charge. */
function mergeLines(charges: readonly ChargeLine[], current: InvoiceRow | null): InvoiceLineInput[] {
	const charged = new Set(charges.flatMap((charge) => (charge.serviceItemId ? [charge.serviceItemId] : [])));
	const chargedNames = new Set(charges.map((charge) => charge.description.trim().toLowerCase()));
	const kept = (current?.lines ?? []).filter((line) =>
		line.serviceItemId
			? !charged.has(line.serviceItemId)
			: !chargedNames.has(line.description.trim().toLowerCase()),
	);
	return [
		...charges.map((charge) => ({
			serviceItemId: charge.serviceItemId,
			description: charge.description,
			quantity: charge.quantity,
			unitPrice: charge.unitPrice,
			taxType: charge.taxType,
			practitionerId: charge.practitionerId,
			stockMovementIds: charge.stockMovementIds,
		})),
		...kept.map((line) => ({
			serviceItemId: line.serviceItemId,
			description: line.description,
			quantity: line.quantity.toNumber(),
			unitPrice: line.unitPrice.toNumber(),
			taxType: line.taxType,
			practitionerId: line.practitionerId,
			stockMovementIds: line.stockMovementIds,
		})),
	];
}

/** The draft's discounts and withholding as a save input, so loading charges keeps them. */
function discountFieldsOf(
	current: InvoiceRow | null,
): Omit<SaveInvoiceDraftInput, 'encounterId' | 'lines' | 'expectedVersion' | 'wiseOrigin'> {
	if (!current) {
		return {};
	}
	const statutory = current.discounts.find((row) => row.type === 'SENIOR_CITIZEN' || row.type === 'PWD');
	const other = current.discounts.find(
		(row) => row.type === 'EMPLOYEE' || row.type === 'PROMO' || row.type === 'SPECIAL',
	);
	return {
		discountType: statutory?.type ?? null,
		discountIdentificationId: statutory?.identificationId ?? null,
		discountIdNumber: statutory?.identificationId ? null : (statutory?.idNumber ?? null),
		otherDiscountType: other?.type ?? null,
		otherDiscountPercent: other && !other.rate.isZero() ? other.rate.times(100).toNumber() : null,
		otherDiscountAmount: other && other.rate.isZero() ? other.amount.toNumber() : null,
		otherDiscountApprovedById: other?.approvedById ?? null,
		withholdingTaxRate: current.withholdingTaxRate.isZero() ? null : current.withholdingTaxRate.toNumber(),
	};
}
