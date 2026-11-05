import { Injectable, Logger } from '@nestjs/common';

import { EntityNotFoundError } from '../../../common/errors/domain-error.js';
import { AuditService } from '../../audit/audit.service.js';
import { DocumentSequenceService } from '../../clinics/document-sequences/document-sequence.service.js';
import { ClinicalDbService } from '../../rls/clinical-db.service.js';
import { assertCardPatient, WiseProposalService } from '../../wise-proposals/wise-proposal.service.js';
import { DiagnosticTestRepository } from '../catalog/diagnostic-test.repository.js';
import {
	DiagnosticTestNotOrderableError,
	EncounterNotOrderableError,
	NotAllowedToCancelOrderError,
	NothingToCancelError,
	ReasonRequiredError,
	RequestingPhysicianRequiredError,
} from '../diagnostics.errors.js';
import { LabDeskAccess } from '../lab-desk-access.js';
import { DiagnosticOrderRepository } from './diagnostic-order.repository.js';
import { CANCELLABLE_STATUSES } from './diagnostic-order-status.js';
import { DiagnosticOrderTransitions } from './diagnostic-order-transitions.service.js';
import type { CancelDiagnosticOrderInput, CreateDiagnosticOrderInput } from './dto/diagnostic-order.input.js';
import { type DiagnosticOrder, toDiagnosticOrder } from './models/diagnostic-order.model.js';

/**
 * Lab and imaging requests of a visit (the doctor's side): ordering tests from the organization's catalog, listing a
 * visit's orders with their results, and cancelling a test before its result. Every call runs as the user under
 * row-level security; every view and change writes an audit row (RA 10173, the Data Privacy Act).
 */
@Injectable()
export class DiagnosticOrderService {
	private readonly logger = new Logger(DiagnosticOrderService.name);

	constructor(
		private readonly db: ClinicalDbService,
		private readonly orders: DiagnosticOrderRepository,
		private readonly tests: DiagnosticTestRepository,
		private readonly transitions: DiagnosticOrderTransitions,
		private readonly sequences: DocumentSequenceService,
		private readonly labDesk: LabDeskAccess,
		private readonly audit: AuditService,
		private readonly wiseProposals: WiseProposalService,
	) {}

	/** The visit's orders, oldest first, each with its tests and results; audited as a view of the patient's record. */
	listForEncounter(userId: string, encounterId: string): Promise<DiagnosticOrder[]> {
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.orders.findOrderingEncounter(tx, encounterId);
			if (!encounter) {
				throw new EntityNotFoundError('Encounter', encounterId);
			}
			const rows = await this.orders.listForEncounter(tx, encounterId);
			if (rows.length > 0) {
				await this.audit.view(tx, {
					event: 'diagnostic_order.list',
					entityType: 'Encounter',
					entityId: encounterId,
					userId,
					patientId: encounter.patientId,
					clinicId: encounter.clinic.id,
					organizationId: encounter.clinic.organizationId,
				});
			}
			return rows.map(toDiagnosticOrder);
		});
	}

	/**
	 * Requests tests for a visit: one order (`orderNo` from the clinic's LAB_ORDER sequence), one item per test, all or
	 * none. Only tests of the visit's organization's active catalog; the requesting physician is the user's
	 * practitioner record, or the outside doctor named on a walk-in request. A Wise `propose_order` card is verified against
	 * the visit's organization (its Wise tool settings) and settled in the same transaction.
	 */
	async create(userId: string, input: CreateDiagnosticOrderInput): Promise<DiagnosticOrder> {
		const testIds = [...new Set(input.testIds)];
		const card = input.wiseOrigin
			? await this.wiseProposals.verifyAction(
					userId,
					input.wiseOrigin,
					'createDiagnosticOrder',
					await this.db.asUser(
						userId,
						async (tx) =>
							(await this.orders.findOrderingEncounter(tx, input.encounterId))?.clinic.organizationId,
					),
				)
			: undefined;
		return this.db.asUser(userId, async (tx) => {
			const encounter = await this.orders.findOrderingEncounter(tx, input.encounterId);
			if (!encounter) {
				throw new EntityNotFoundError('Encounter', input.encounterId);
			}
			if (encounter.status === 'CANCELLED') {
				throw new EncounterNotOrderableError(encounter.encounterNo);
			}
			assertCardPatient(card, encounter.patientId);
			const tests = await this.tests.findActiveByIds(tx, encounter.clinic.organizationId, testIds);
			if (tests.length !== testIds.length) {
				throw new DiagnosticTestNotOrderableError();
			}
			const externalPhysician = input.externalPhysician?.trim() || null;
			const requestedById = await this.orders.findPractitionerIdOfUser(tx, userId);
			if (!requestedById && !externalPhysician) {
				throw new RequestingPhysicianRequiredError();
			}
			const row = await this.orders.create(tx, {
				orderNo: await this.sequences.next(tx, encounter.clinic, 'LAB_ORDER'),
				encounterId: encounter.id,
				requestedById,
				externalPhysician,
				priority: input.priority ?? 'ROUTINE',
				clinicalInfo: input.clinicalInfo?.trim() || null,
				isExternal: input.isExternal ?? false,
				testIds,
			});
			await this.audit.created(tx, {
				event: 'diagnostic_order.create',
				entityType: 'DiagnosticOrder',
				entityId: row.id,
				userId,
				patientId: encounter.patientId,
				clinicId: encounter.clinic.id,
				organizationId: encounter.clinic.organizationId,
				changes: {
					after: {
						orderNo: row.orderNo,
						priority: row.priority,
						tests: row.items.map((item) => item.test.code),
					},
				},
				origin: card?.origin,
			});
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'DiagnosticOrder',
				entityId: row.id,
			});
			this.logger.log(`Order ${row.orderNo} created with ${row.items.length} test(s)`);
			return toDiagnosticOrder(row);
		});
	}

	/**
	 * Cancels one test of an order, or every test still open, before its result is in (the trigger refuses it after).
	 * For the requesting doctor, or the lab of the visit's clinic (a specimen it can't run); the reason is kept on the
	 * test and in the audit row. A Wise card (`propose_cancel_order`, `propose_lab_order_step`) is verified against the
	 * visit's organization.
	 */
	async cancel(userId: string, input: CancelDiagnosticOrderInput): Promise<DiagnosticOrder> {
		const reason = input.reason.trim();
		if (!reason) {
			throw new ReasonRequiredError();
		}
		return this.db.asUser(userId, async (tx) => {
			const order = await this.orders.findById(tx, input.orderId);
			if (!order) {
				throw new EntityNotFoundError('DiagnosticOrder', input.orderId);
			}
			const { clinic, patientId } = order.encounter;
			const isRequester = order.requestedBy?.userId === userId;
			if (!isRequester && !(await this.labDesk.isLabDesk(userId, clinic.id))) {
				throw new NotAllowedToCancelOrderError();
			}
			const card = await this.wiseProposals.verifyAction(
				userId,
				input.wiseOrigin,
				'cancelDiagnosticOrder',
				clinic.organizationId,
			);
			assertCardPatient(card, patientId);
			const items = input.itemId
				? order.items.filter((item) => item.id === input.itemId)
				: order.items.filter((item) => CANCELLABLE_STATUSES.includes(item.status));
			if (input.itemId && items.length === 0) {
				throw new EntityNotFoundError('DiagnosticOrderItem', input.itemId);
			}
			if (items.length === 0) {
				throw new NothingToCancelError(order.orderNo);
			}
			const cancelledAt = new Date();
			for (const item of items) {
				await this.transitions.moveItem(tx, { ...item, orderId: order.id }, 'CANCELLED', {
					statusReason: reason,
					cancelledAt,
				});
				await this.audit.updated(tx, {
					event: 'diagnostic_order.cancel',
					entityType: 'DiagnosticOrderItem',
					entityId: item.id,
					userId,
					patientId,
					clinicId: clinic.id,
					organizationId: clinic.organizationId,
					changes: { before: { status: item.status }, after: { status: 'CANCELLED' } },
					reason,
					origin: card?.origin,
				});
			}
			await this.wiseProposals.settleAction(tx, userId, card, {
				entityType: 'DiagnosticOrder',
				entityId: order.id,
			});
			const updated = await this.orders.findById(tx, order.id);
			return toDiagnosticOrder(updated ?? order);
		});
	}
}
