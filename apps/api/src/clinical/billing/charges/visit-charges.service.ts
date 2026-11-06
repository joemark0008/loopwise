import type { TaxType } from '@loopwise/shared/invoice';
import { Inject, Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { ChargeSource } from '../invoices/models/encounter-billing.model.js';
import type { ServiceItemPrice } from '../service-items/models/service-item.model.js';
import { DISPENSED_CHARGES, type DispensedChargesSource } from './dispensed-charges.port.js';
import { VisitChargesRepository } from './visit-charges.repository.js';

/** A line "Load charges" puts on the draft. */
export interface ChargeLine {
	source: ChargeSource;
	serviceItemId: string | null;
	description: string;
	quantity: number;
	unitPrice: number;
	taxType: TaxType;
	/** Whose fee the line is (the visit's doctor for the consultation). */
	practitionerId: string | null;
	isProfessionalFee: boolean;
}

/** The visit, as charging needs it. */
export interface ChargedVisit {
	id: string;
	clinicId: string;
	practitionerId: string | null;
	type: string;
}

/**
 * What a visit is charged for, built from the visit itself ("Load charges"): the consultation, at the doctor's consult
 * fee at the clinic, else the item's clinic price (`clinic_service_prices`), else its default price; each test ordered
 * (not cancelled), at the price of the item that bills it (₱0 and named when none does, for the desk to price); and
 * the medicines dispensed, from the pharmacy's hook (`DISPENSED_CHARGES`), at the price given, else the linked item's.
 * The consultation names the doctor, and is their professional fee when the item is PF-shareable.
 */
@Injectable()
export class VisitChargesService {
	constructor(
		private readonly charges: VisitChargesRepository,
		@Inject(DISPENSED_CHARGES) private readonly dispensed: DispensedChargesSource,
	) {}

	async chargesFor(
		tx: ClinicalTx,
		userId: string,
		visit: ChargedVisit,
		priceList: readonly ServiceItemPrice[],
	): Promise<ChargeLine[]> {
		const consultation = await this.consultation(tx, visit, priceList);
		const tests = await this.charges.listOrderedTests(tx, visit.id);
		const dispensed = await this.dispensed.dispensedChargesFor(visit.id, { userId, tx });
		const byTest = new Map(
			priceList.flatMap((item) => (item.diagnosticTestId ? [[item.diagnosticTestId, item]] : [])),
		);
		const byStock = new Map(
			priceList.flatMap((item) => (item.inventoryItemId ? [[item.inventoryItemId, item]] : [])),
		);
		const byId = new Map(priceList.map((item) => [item.id, item]));
		return [
			...(consultation ? [consultation] : []),
			...tests.map((test): ChargeLine => {
				const item = byTest.get(test.testId);
				return item
					? fromItem(ChargeSource.DIAGNOSTIC, item, 1, item.price, null)
					: {
							source: ChargeSource.DIAGNOSTIC,
							serviceItemId: null,
							description: test.name,
							quantity: 1,
							unitPrice: 0,
							taxType: 'VAT_EXEMPT',
							practitionerId: null,
							isProfessionalFee: false,
						};
			}),
			...dispensed.map((charge): ChargeLine => {
				const item =
					(charge.serviceItemId ? byId.get(charge.serviceItemId) : undefined) ??
					(charge.inventoryItemId ? byStock.get(charge.inventoryItemId) : undefined);
				if (item) {
					return fromItem(
						ChargeSource.DISPENSED,
						item,
						charge.quantity,
						charge.unitPrice ?? item.price,
						null,
					);
				}
				return {
					source: ChargeSource.DISPENSED,
					serviceItemId: null,
					description: charge.description,
					quantity: charge.quantity,
					unitPrice: charge.unitPrice ?? 0,
					taxType: charge.taxType ?? 'VATABLE',
					practitionerId: null,
					isProfessionalFee: false,
				};
			}),
		];
	}

	/** The consultation: a follow-up visit takes a follow-up item when the price list has one. */
	private async consultation(
		tx: ClinicalTx,
		visit: ChargedVisit,
		priceList: readonly ServiceItemPrice[],
	): Promise<ChargeLine | null> {
		const consultations = priceList.filter((item) => item.category === 'CONSULTATION');
		const followUp = consultations.find((item) => /follow/i.test(item.name) || /-FU$/i.test(item.code));
		const item =
			(visit.type === 'FOLLOW_UP' ? followUp : undefined) ??
			consultations.find((candidate) => candidate !== followUp) ??
			consultations[0];
		const terms = visit.practitionerId
			? await this.charges.findPractitionerTerms(tx, visit.practitionerId, visit.clinicId)
			: null;
		// The doctor's own fee applies to a first consultation; a follow-up item keeps its price.
		const ownFee = terms?.consultFee ?? terms?.practitioner.defaultConsultFee ?? null;
		const fee = ownFee && item !== followUp ? ownFee.toNumber() : null;
		if (!item) {
			return fee === null
				? null
				: {
						source: ChargeSource.CONSULTATION,
						serviceItemId: null,
						description: 'Consultation',
						quantity: 1,
						unitPrice: fee,
						taxType: 'VAT_EXEMPT',
						practitionerId: visit.practitionerId,
						isProfessionalFee: true,
					};
		}
		return fromItem(ChargeSource.CONSULTATION, item, 1, fee ?? item.price, visit.practitionerId);
	}
}

function fromItem(
	source: ChargeSource,
	item: ServiceItemPrice,
	quantity: number,
	unitPrice: number,
	practitionerId: string | null,
): ChargeLine {
	const isProfessionalFee = item.category === 'PROFESSIONAL_FEE' || item.isPfShareable;
	return {
		source,
		serviceItemId: item.id,
		description: item.name,
		quantity,
		unitPrice,
		taxType: item.taxType,
		practitionerId: isProfessionalFee || item.category === 'CONSULTATION' ? practitionerId : null,
		isProfessionalFee,
	};
}
