import { Injectable } from '@nestjs/common';
import { BillDraftSchema, computeBillTotals } from '@quarry/shared/encounter-bill';
import { VoidReasonSchema } from '@quarry/shared/encounter-record';
import type { WiseActionMutation } from '@quarry/shared/wise-actions';
import { staleEditMessage } from '@quarry/shared/wise-proposal';

import { HandlerError } from '../../common/errors/handler-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import type { VoidEntryInput } from '../encounters/dto/encounter-record.input.js';
import { EncounterRepository } from '../encounters/encounter.repository.js';
import { assertSavedFromVersion, encounterForWrite, parseOrThrow } from '../encounters/encounter-access.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, type WiseOrigin, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import { BillingRepository } from './billing.repository.js';
import type { MarkBillPaidInput, SaveEncounterBillInput } from './dto/encounter-bill.input.js';
import { type BillRow, type EncounterBill, toEncounterBill } from './models/encounter-bill.model.js';

type Tx = Prisma.TransactionClient;

/**
 * The bill of an encounter (DESIGN.md §7). A draft is saved and replaced freely and its totals are computed here
 * (never taken from the client); finalizing locks it (a trigger allows only paying or voiding). One bill per encounter
 * that is not voided. Only staff at the encounter's facility bill; every change is audited.
 */
@Injectable()
export class BillingService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly bills: BillingRepository,
		private readonly encounters: EncounterRepository,
		private readonly organizations: OrganizationRepository,
		private readonly audit: ClinicalAuditRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	async save(userId: string, input: SaveEncounterBillInput): Promise<EncounterBill> {
		const draft = parseOrThrow(BillDraftSchema, {
			charges: input.charges,
			discountKind: input.discountKind,
			philhealthPackageCode: input.philhealthPackageCode,
			philhealthCoverage: input.philhealthCoverage,
		});
		const totals = computeBillTotals(draft.charges, draft.discountKind, draft.philhealthCoverage);
		const charges = draft.charges.map((charge, position) => ({
			position,
			kind: charge.kind,
			description: charge.description,
			code: charge.code ?? null,
			quantity: charge.quantity,
			unitPrice: charge.unitPrice,
			amount: totals.amounts[position],
		}));
		const fields = {
			subtotal: totals.subtotal,
			discountKind: draft.discountKind ?? null,
			discountAmount: totals.discountAmount,
			philhealthPackageCode: draft.philhealthPackageCode ?? null,
			philhealthCoverage: totals.philhealthCoverage,
			total: totals.total,
		};
		const facilityIds = await this.facilityIds(userId);
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, { toolNames: ['propose_charges'] })
			: undefined;
		return this.db.asUser(userId, async (tx) => {
			const encounter = await encounterForWrite(tx, this.encounters, facilityIds, input.encounterId);
			assertCardPatient(card, encounter.patientId);
			const current = await this.bills.findActive(tx, encounter.id);
			if (current && current.status !== 'draft') {
				throw new HandlerError('CONFLICT', `The bill is ${current.status}; void it to bill again.`);
			}
			// A card drafted a new bill or a change to the draft it showed; a draft made or dropped since is stale.
			if (card && Boolean(current) !== (input.expectedVersion != null)) {
				throw new HandlerError('CONFLICT', staleEditMessage('bill'));
			}
			const row = current
				? await this.bills.replaceDraft(tx, current.id, fields, charges)
				: await this.bills.create(
						tx,
						{
							...fields,
							encounterId: encounter.id,
							patientId: encounter.patientId,
							orgId: encounter.orgId,
						},
						charges,
					);
			if (current) {
				assertSavedFromVersion(row, input.expectedVersion, 'bill');
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'encounter_bill', resourceId: row.id });
			}
			await this.writeAudit(tx, userId, row, 'bill.save', undefined, card?.origin);
			return toEncounterBill(row);
		});
	}

	finalize(userId: string, id: string, wiseOrigin?: WiseOriginInput | null): Promise<EncounterBill> {
		return this.transition(
			userId,
			id,
			'bill.finalize',
			{ mutation: 'finalizeEncounterBill', wiseOrigin },
			(current) => {
				if (current.status !== 'draft') {
					throw new HandlerError('CONFLICT', `This bill is already ${current.status}.`);
				}
				return { status: 'finalized', finalizedAt: new Date() };
			},
		);
	}

	markPaid(userId: string, input: MarkBillPaidInput): Promise<EncounterBill> {
		const orNumber = input.orNumber.trim();
		if (!orNumber) {
			throw new HandlerError('BAD_REQUEST', 'Add the official receipt number.');
		}
		return this.transition(
			userId,
			input.id,
			'bill.pay',
			{ mutation: 'markEncounterBillPaid', wiseOrigin: input.wiseOrigin },
			(current) => {
				if (current.status !== 'finalized') {
					throw new HandlerError('CONFLICT', 'Only a finalized bill can be marked paid.');
				}
				return { status: 'paid', paidAt: new Date(), orNumber };
			},
		);
	}

	void(userId: string, input: VoidEntryInput): Promise<EncounterBill> {
		const voidReason = parseOrThrow(VoidReasonSchema, input.reason);
		return this.transition(
			userId,
			input.id,
			'bill.void',
			{ mutation: 'voidEncounterBill', wiseOrigin: input.wiseOrigin },
			(current) => {
				if (current.status === 'voided') {
					throw new HandlerError('CONFLICT', 'This bill is already voided.');
				}
				return { status: 'voided', voidedAt: new Date(), voidedById: userId, voidReason };
			},
			voidReason,
		);
	}

	private async transition(
		userId: string,
		id: string,
		action: string,
		wise: { mutation: WiseActionMutation; wiseOrigin?: WiseOriginInput | null },
		change: (current: BillRow) => Prisma.EncounterBillUncheckedUpdateInput,
		reason?: string,
	): Promise<EncounterBill> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const current = await this.bills.findById(tx, id);
			if (!current) {
				throw new HandlerError('NOT_FOUND', 'Bill not found.');
			}
			await encounterForWrite(tx, this.encounters, facilityIds, current.encounterId);
			const card = await this.wiseProposals.verifyAction(userId, wise.wiseOrigin, wise.mutation, current.orgId);
			assertCardPatient(card, current.patientId);
			const data = change(current);
			if (action === 'bill.finalize') {
				data.finalizedById = userId;
			}
			const row = await this.bills.update(tx, id, data);
			await this.wiseProposals.settleAction(tx, userId, card, { resource: 'encounter_bill', resourceId: row.id });
			await this.writeAudit(tx, userId, row, action, reason, card?.origin);
			return toEncounterBill(row);
		});
	}

	private writeAudit(tx: Tx, userId: string, row: BillRow, action: string, reason?: string, origin?: WiseOrigin) {
		return this.audit.write(tx, {
			origin,
			userId,
			orgId: row.orgId,
			patientId: row.patientId,
			action,
			resource: 'encounter_bill',
			resourceId: row.id,
			reason,
		});
	}

	private async facilityIds(userId: string): Promise<string[]> {
		return (await this.organizations.getUserFacilities(userId)).map((facility) => facility.id);
	}
}
