import { DISCOUNT_ID_TYPES, STATUTORY_DISCOUNT_TYPES } from '@loopwise/shared/invoice';
import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { type BillingActor, holdsBillingRole, INVOICE_COLLECT_ROLES, INVOICE_DRAFT_ROLES } from '../billing-access.js';
import type { ServiceItemPrice } from '../service-items/models/service-item.model.js';
import { ServiceItemService } from '../service-items/service-item.service.js';
import { InvoiceRepository } from './invoice.repository.js';
import type { EncounterBilling, SuggestedInvoiceLine } from './models/encounter-billing.model.js';
import { toInvoice } from './models/invoice.model.js';

/**
 * The billing view of a visit, read as the user (row-level security): its invoices, the clinic's price list, the
 * lines to start a new invoice with (the consultation and the tests ordered), and the patient's senior citizen / PWD
 * IDs on file. Audited as a view of the patient's record (RA 10173).
 */
@Injectable()
export class EncounterBillingService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoices: InvoiceRepository,
		private readonly serviceItems: ServiceItemService,
		private readonly audit: AuditService,
	) {}

	get(actor: BillingActor, encounterId: string): Promise<EncounterBilling> {
		return this.db.asUser(actor.userId, async (tx) => {
			const encounter = await this.invoices.findEncounter(tx, encounterId);
			if (!encounter) {
				throw new EntityNotFoundError('Encounter', encounterId);
			}
			const clinic = { id: encounter.clinic.id, organizationId: encounter.clinic.organizationId };
			// One after another: the queries share the transaction's connection.
			const invoices = await this.invoices.listForEncounter(tx, encounter.id);
			const priceList = await this.serviceItems.priceList(tx, clinic);
			const tests = await this.invoices.listOrderedTests(tx, encounter.id);
			const identifications = await this.invoices.listDiscountIdentifications(
				tx,
				encounter.patientId,
				STATUTORY_DISCOUNT_TYPES.map((type) => DISCOUNT_ID_TYPES[type]),
			);
			await this.audit.view(tx, {
				event: 'invoice.list',
				entityType: 'Encounter',
				entityId: encounter.id,
				userId: actor.userId,
				patientId: encounter.patientId,
				clinicId: encounter.clinicId,
				organizationId: encounter.clinic.organizationId,
			});
			const atClinic = encounter.clinicId === actor.clinicId;
			return {
				encounterId: encounter.id,
				clinicId: encounter.clinicId,
				patientId: encounter.patientId,
				invoices: invoices.map(toInvoice),
				priceList,
				suggestedLines: suggestLines(priceList, tests),
				discountIdentifications: identifications.map((identification) => ({
					id: identification.id,
					discountType: identification.type === 'PWD' ? 'PWD' : 'SENIOR_CITIZEN',
					idNumber: identification.idNumber,
				})),
				canDraft: atClinic && holdsBillingRole(actor, INVOICE_DRAFT_ROLES),
				canCollect: atClinic && holdsBillingRole(actor, INVOICE_COLLECT_ROLES),
			};
		});
	}
}

/** The consultation (the first consultation item of the price list), then each test ordered at its price. */
export function suggestLines(
	priceList: readonly ServiceItemPrice[],
	tests: readonly { testId: string; name: string }[],
): SuggestedInvoiceLine[] {
	const line = (item: ServiceItemPrice): SuggestedInvoiceLine => ({
		serviceItemId: item.id,
		description: item.name,
		quantity: 1,
		unitPrice: item.price,
		taxType: item.taxType,
	});
	const consultation = priceList.find((item) => item.category === 'CONSULTATION');
	const byTest = new Map(
		priceList.filter((item) => item.diagnosticTestId).map((item) => [item.diagnosticTestId, item]),
	);
	return [
		...(consultation ? [line(consultation)] : []),
		...tests.map((test) => {
			const item = byTest.get(test.testId);
			return item
				? line(item)
				: {
						serviceItemId: null,
						description: test.name,
						quantity: 1,
						unitPrice: 0,
						taxType: 'VAT_EXEMPT' as const,
					};
		}),
	];
}
