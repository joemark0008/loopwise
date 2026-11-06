import { Injectable } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import {
	type BillingActor,
	holdsBillingRole,
	INVOICE_COLLECT_ROLES,
	INVOICE_DRAFT_ROLES,
	isBillingAdmin,
} from '../billing-access.js';
import { CashierShiftRepository } from '../cashier-shifts/cashier-shift.repository.js';
import { VisitChargesService } from '../charges/visit-charges.service.js';
import { InvoiceDiscountService } from '../discounts/invoice-discount.service.js';
import { ServiceItemService } from '../service-items/service-item.service.js';
import { InvoiceRepository } from './invoice.repository.js';
import type { EncounterBilling } from './models/encounter-billing.model.js';
import { toInvoice } from './models/invoice.model.js';

/**
 * The billing view of a visit, read as the user (row-level security): its invoices, the clinic's price list, the
 * charges "Load charges" would put on the invoice (the consultation, the tests ordered, the medicines dispensed), the
 * patient's senior citizen / PWD IDs on file, who may approve another discount, and whether the user has an open
 * cashier shift. Audited as a view of the patient's record (RA 10173).
 */
@Injectable()
export class EncounterBillingService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly invoices: InvoiceRepository,
		private readonly serviceItems: ServiceItemService,
		private readonly charges: VisitChargesService,
		private readonly discounts: InvoiceDiscountService,
		private readonly shifts: CashierShiftRepository,
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
			const draft = invoices.find((invoice) => invoice.status === 'DRAFT');
			const suggestedLines = await this.charges.chargesFor(tx, actor.userId, encounter, priceList, {
				draftInvoiceId: draft?.id ?? null,
			});
			const identifications = await this.discounts.identifications(tx, encounter.patientId);
			const approvers = await this.discounts.approvers(tx, encounter.clinicId);
			const shift = await this.shifts.findOpen(tx, actor.clinicId, actor.userId);
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
				vatRegistered: encounter.clinic.organization.vatRegistration === 'VAT',
				invoices: invoices.map(toInvoice),
				priceList,
				suggestedLines,
				discountIdentifications: identifications,
				discountApprovers: approvers,
				canDraft: atClinic && holdsBillingRole(actor, INVOICE_DRAFT_ROLES),
				canCollect: atClinic && holdsBillingRole(actor, INVOICE_COLLECT_ROLES),
				canVoid: atClinic && isBillingAdmin(actor),
				openShiftId: atClinic ? (shift?.id ?? null) : null,
			};
		});
	}
}
