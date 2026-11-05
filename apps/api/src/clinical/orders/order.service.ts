import { findLabTest, LAB_TESTS, type LabTest } from '@loopwise/shared/lab-tests';
import type { listLabOrders } from '@loopwise/shared/tools';
import { type WiseActionMutation, wiseActionToolsFor } from '@loopwise/shared/wise-actions';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../../common/errors/handler-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { OrderStatus } from '../../generated/prisma/enums.js';
import { OrganizationRepository } from '../../organizations/organization.repository.js';
import { ClinicalAuditRepository } from '../audit/clinical-audit.repository.js';
import { EncounterRepository } from '../encounters/encounter.repository.js';
import { encounterForWrite } from '../encounters/encounter-access.js';
import type { Facility } from '../patients/models/patient.model.js';
import { ClinicalDbService } from '../rls/clinical-db.service.js';
import type { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { assertCardPatient, type WiseOrigin, WiseProposalService } from '../wise-proposals/wise-proposal.service.js';
import type { CreateEncounterOrderInput, CreateEncounterOrdersInput } from './dto/order.input.js';
import { buildOrmO01, hl7ControlId, type OrderControl } from './hl7/orm-message.js';
import {
	type ClinicalOrder,
	type LabOrder,
	type LabOrderCount,
	type OrderRow,
	toClinicalOrder,
	toLabOrder,
} from './models/order.model.js';
import { OrderRepository, type OutboundOrderRow } from './order.repository.js';
import { canTransition, ORDER_STEPS, type OrderStep, transitionRefusal } from './order-status.js';

type Tx = Prisma.TransactionClient;

/** The worklist tabs of the receiving facility: what it still has to do, and what it finished. */
/** The steps a user takes from the app (the others come from HL7 and the results module). */
type UserStep = 'accept' | 'collect' | 'reject' | 'cancel';

/** The mutation each step is, for the Wise action card that may confirm it. */
const STEP_MUTATIONS: Record<UserStep, WiseActionMutation> = {
	accept: 'acceptOrder',
	collect: 'markOrderCollected',
	reject: 'rejectOrder',
	cancel: 'cancelOrder',
};

export const LAB_WORKLIST_STATUSES = ['sent', 'accepted', 'collected', 'resulted'] as const satisfies OrderStatus[];

/** Who takes a step: a signed-in user, or the hub acting for a facility's connector (HL7). */
type StepActor = { userId: string } | { system: true; orgId: string | null };

/** An inbound ORM/OML status update from a lab system (ORC-1 order control, ORC-5 order status). */
export interface LabStatusUpdate {
	/** ORC-2 (placer order number), our order id. */
	placerOrderId: string;
	orderControl: string;
	orderStatus: string | null;
}

/** The step a lab status update asks for: ORC-1 SC/OK with ORC-5 IP → accepted, CM → collected; UA/OC → rejected. */
export function labStatusStep(update: Pick<LabStatusUpdate, 'orderControl' | 'orderStatus'>): OrderStep | null {
	const control = update.orderControl.toUpperCase();
	const status = update.orderStatus?.toUpperCase() ?? '';
	if (control === 'OK' || (control === 'SC' && status === 'IP')) {
		return 'accept';
	}
	if (control === 'SC' && status === 'CM') {
		return 'collect';
	}
	if (control === 'UA' || control === 'OC' || (control === 'SC' && status === 'CA')) {
		return 'reject';
	}
	return null;
}

/**
 * Orders (DESIGN.md §2 steps 1–5, §5, §9). The encounter orders a test and sends it to a lab or imaging facility;
 * the facility's staff accept, reject and mark the specimen collected on the worklist (or its lab system does over
 * HL7); results arrive (`setResulted`, called by the HL7 ingest) and the doctor reviews them
 * (`setReviewed`).
 * Every step runs under row-level security as the user, checks `order-status.ts`, and writes an audit row. Orders for
 * a facility that uses the edge connector also go out as HL7 ORM^O01 through `hl7_outbox`.
 */
@Injectable()
export class OrderService {
	constructor(
		private readonly db: ClinicalDbService,
		private readonly orders: OrderRepository,
		private readonly encounters: EncounterRepository,
		private readonly organizations: OrganizationRepository,
		private readonly audit: ClinicalAuditRepository,
		private readonly wiseProposals: WiseProposalService,
	) {}

	orderableTests(): readonly LabTest[] {
		return LAB_TESTS;
	}

	orderTargets(userId: string): Promise<Facility[]> {
		return this.db.asUser(userId, async (tx) =>
			(await this.orders.listTargets(tx)).map(({ id, name, slug, type }) => ({ id, name, slug, type })),
		);
	}

	async createForEncounter(userId: string, input: CreateEncounterOrderInput): Promise<ClinicalOrder> {
		const test = findLabTest(input.code);
		if (!test) {
			throw new HandlerError('BAD_REQUEST', 'Pick a test from the list.');
		}
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const encounter = await encounterForWrite(tx, this.encounters, facilityIds, input.encounterId);
			if (!(await this.orders.findTarget(tx, input.targetOrgId))) {
				throw new HandlerError('BAD_REQUEST', 'Send the order to a lab, imaging center or hospital.');
			}
			return this.createInTx(tx, userId, encounter, test, input);
		});
	}

	/**
	 * Several tests from one encounter to one facility, all or none (Wise's `propose_order`; the encounter page orders
	 * one at a time). With `wiseOrigin` the card is verified at the visit's facility and settled once, in the same
	 * transaction; each order is audited and queued for HL7 as `createForEncounter` does.
	 */
	async createManyForEncounter(userId: string, input: CreateEncounterOrdersInput): Promise<ClinicalOrder[]> {
		const tests = [...new Set(input.codes)].map((code) => findLabTest(code));
		if (tests.length === 0 || tests.some((test) => !test)) {
			throw new HandlerError('BAD_REQUEST', 'Pick tests from the list.');
		}
		const facilityIds = await this.facilityIds(userId);
		const card = input.wiseOrigin
			? await this.wiseProposals.verify(userId, input.wiseOrigin, {
					toolNames: wiseActionToolsFor('createEncounterOrders'),
					facilityId: await this.db.asUser(
						userId,
						async (tx) => (await this.encounters.findById(tx, input.encounterId))?.orgId,
					),
				})
			: undefined;
		return this.db.asUser(userId, async (tx) => {
			const encounter = await encounterForWrite(tx, this.encounters, facilityIds, input.encounterId);
			assertCardPatient(card, encounter.patientId);
			if (!(await this.orders.findTarget(tx, input.targetOrgId))) {
				throw new HandlerError('BAD_REQUEST', 'Send the order to a lab, imaging center or hospital.');
			}
			const created: ClinicalOrder[] = [];
			for (const test of tests as LabTest[]) {
				created.push(await this.createInTx(tx, userId, encounter, test, input, card?.origin));
			}
			if (card) {
				await this.wiseProposals.settle(tx, userId, card, { resource: 'encounter', resourceId: encounter.id });
			}
			return created;
		});
	}

	/** One order in the caller's transaction: the row, its audit row (with the Wise origin, if any), its HL7. */
	private async createInTx(
		tx: Prisma.TransactionClient,
		userId: string,
		encounter: { id: string; patientId: string; orgId: string },
		test: LabTest,
		input: Pick<CreateEncounterOrderInput, 'targetOrgId' | 'priority' | 'notes'>,
		origin?: Prisma.InputJsonObject,
	): Promise<ClinicalOrder> {
		const row = await this.orders.create(tx, {
			encounterId: encounter.id,
			patientId: encounter.patientId,
			orderingDoctorId: userId,
			orderingOrgId: encounter.orgId,
			targetOrgId: input.targetOrgId,
			code: test.code,
			display: test.display,
			priority: input.priority ?? 'routine',
			status: 'sent',
			sentAt: new Date(),
			notes: input.notes?.trim() || null,
		});
		await this.audit.write(tx, {
			userId,
			orgId: encounter.orgId,
			patientId: encounter.patientId,
			action: 'order.create',
			resource: 'clinical_order',
			resourceId: row.id,
			origin,
		});
		await this.enqueueHl7(tx, row.id, 'NW');
		return toClinicalOrder(row);
	}

	/** The receiving facility's worklist for one status (oldest first). */
	async labOrders(userId: string, status: OrderStatus): Promise<LabOrder[]> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) =>
			(await this.orders.listForTargets(tx, facilityIds, [status])).map(toLabOrder),
		);
	}

	/** How many orders each worklist tab holds. */
	async labOrderCounts(userId: string): Promise<LabOrderCount[]> {
		const facilityIds = await this.facilityIds(userId);
		const groups = await this.db.asUser(userId, (tx) => this.orders.countByStatusForTargets(tx, facilityIds));
		return LAB_WORKLIST_STATUSES.map((status) => ({
			status,
			count: groups.find((group) => group.status === status)?._count._all ?? 0,
		}));
	}

	/** The receiving facility takes the order (DESIGN.md §2 step 2). */
	accept(userId: string, orderId: string, wiseOrigin?: WiseOriginInput | null): Promise<ClinicalOrder> {
		return this.asUserStep(userId, orderId, 'accept', null, wiseOrigin);
	}

	/** The receiving facility refuses the order, with the reason the doctor sees. */
	reject(
		userId: string,
		orderId: string,
		reason: string,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalOrder> {
		return this.asUserStep(userId, orderId, 'reject', requireReason(reason), wiseOrigin);
	}

	/** The specimen is taken (DESIGN.md §2 step 4). */
	markCollected(userId: string, orderId: string, wiseOrigin?: WiseOriginInput | null): Promise<ClinicalOrder> {
		return this.asUserStep(userId, orderId, 'collect', null, wiseOrigin);
	}

	/** The ordering doctor withdraws the order before the specimen is taken. */
	cancel(
		userId: string,
		orderId: string,
		reason: string,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalOrder> {
		return this.asUserStep(userId, orderId, 'cancel', requireReason(reason), wiseOrigin);
	}

	/**
	 * Wise's `list_lab_orders`: the worklist of the user's facilities for these statuses, STAT first, then oldest.
	 */
	async labOrdersForWise(
		userId: string,
		opts: { statuses: readonly OrderStatus[]; limit: number },
	): Promise<{ orders: listLabOrders.Order[]; truncated: boolean }> {
		const facilityIds = await this.facilityIds(userId);
		const rows = await this.db.asUser(userId, (tx) => this.orders.listForTargets(tx, facilityIds, opts.statuses));
		const rank = { stat: 0, urgent: 1, routine: 2 };
		const sorted = rows
			.map(toLabOrder)
			.sort(
				(a, b) =>
					rank[a.priority] - rank[b.priority] || (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0),
			);
		return {
			truncated: sorted.length > opts.limit,
			orders: sorted.slice(0, opts.limit).map((order) => ({
				id: order.id,
				test: order.display ?? order.code,
				priority: order.priority,
				status: order.status,
				notes: order.notes,
				sentAt: order.sentAt?.toISOString() ?? null,
				patient: {
					name: `${order.patient.givenName} ${order.patient.familyName}`,
					birthDate: order.patient.birthDate,
					sex: order.patient.sex,
				},
				orderingDoctor: order.orderingDoctorName,
				orderingFacility: order.orderingFacilityName,
			})),
		};
	}

	/**
	 * A result arrived for the order (HL7 ingest, in its system transaction): it is `resulted` again even if already
	 * reviewed, since the new result needs review. Draft, cancelled and rejected orders keep their status. True when
	 * the status changed.
	 */
	async setResulted(tx: Tx, orderId: string): Promise<boolean> {
		const order = await this.orders.findById(tx, orderId);
		if (!order || !canTransition(order.status, 'resulted')) {
			return false;
		}
		await this.step(tx, order, 'result', { system: true, orgId: order.targetOrgId }, null);
		return true;
	}

	/**
	 * After a result review (in the reviewer's `asUser` transaction, whose user the audit row names): `reviewed` once
	 * none of the order's results awaits review. True when the status changed.
	 */
	async setReviewed(tx: Tx, orderId: string): Promise<boolean> {
		const order = await this.orders.findById(tx, orderId);
		if (!order || order.status !== 'resulted' || (await this.orders.countUnreviewedResults(tx, orderId)) > 0) {
			return false;
		}
		const userId = await this.orders.currentUserId(tx);
		await this.step(tx, order, 'review', userId ? { userId } : { system: true, orgId: order.orderingOrgId }, null);
		return true;
	}

	/**
	 * An ORM/OML status update from the lab system of `orgId` (through its connector; the HL7 ingest calls this for
	 * messages that are not ORU). Runs in the caller's (system) transaction. Returns the order after the step, or null
	 * when the message names no order of this facility or asks for nothing we track.
	 */
	async applyLabStatus(tx: Tx, orgId: string, update: LabStatusUpdate): Promise<ClinicalOrder | null> {
		const step = labStatusStep(update);
		const order = await this.orders.findById(tx, update.placerOrderId);
		if (!step || !order || order.targetOrgId !== orgId) {
			return null;
		}
		if (order.status === ORDER_STEPS[step].to) {
			return toClinicalOrder(order);
		}
		// A lab that reports "collected" without "accepted" first: take both steps.
		if (step === 'collect' && order.status === 'sent') {
			const accepted = await this.step(tx, order, 'accept', { system: true, orgId }, null);
			return this.step(tx, { ...order, status: accepted.status }, 'collect', { system: true, orgId }, null);
		}
		const reason = step === 'reject' ? 'Rejected by the lab system (HL7).' : null;
		return this.step(tx, order, step, { system: true, orgId }, reason);
	}

	private async asUserStep(
		userId: string,
		orderId: string,
		step: UserStep,
		reason: string | null,
		wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalOrder> {
		const facilityIds = await this.facilityIds(userId);
		return this.db.asUser(userId, async (tx) => {
			const order = await this.orders.findById(tx, orderId);
			if (!order) {
				throw new HandlerError('NOT_FOUND', 'Order not found.');
			}
			const { actor } = ORDER_STEPS[step];
			const card = await this.wiseProposals.verifyAction(
				userId,
				wiseOrigin,
				STEP_MUTATIONS[step],
				actor === 'lab' ? order.targetOrgId : order.orderingOrgId,
			);
			if (actor === 'orderer') {
				assertCardPatient(card, order.patientId);
			}
			if (actor === 'lab' && !facilityIds.includes(order.targetOrgId)) {
				throw new HandlerError('FORBIDDEN', 'Only staff at the facility the order was sent to can do this.');
			}
			if (actor === 'orderer' && order.orderingDoctorId !== userId) {
				throw new HandlerError('FORBIDDEN', 'Only the doctor who ordered the test can cancel it.');
			}
			const updated = await this.step(tx, order, step, { userId }, reason, card?.origin);
			await this.wiseProposals.settleAction(tx, userId, card, {
				resource: 'clinical_order',
				resourceId: order.id,
			});
			if (step === 'cancel') {
				await this.enqueueHl7(tx, order.id, 'CA');
			}
			return updated;
		});
	}

	/** Moves the order one step and writes the audit row; refuses a step that does not fit the current status. */
	private async step(
		tx: Tx,
		order: OrderRow,
		step: OrderStep,
		actor: StepActor,
		reason: string | null,
		wiseOrigin?: WiseOrigin,
	): Promise<ClinicalOrder> {
		const { to } = ORDER_STEPS[step];
		if (!canTransition(order.status, to)) {
			throw new HandlerError('CONFLICT', transitionRefusal(order.status, step));
		}
		const now = new Date();
		const stamp: Prisma.ClinicalOrderUncheckedUpdateManyInput =
			{
				accepted: { acceptedAt: now },
				collected: { collectedAt: now },
				resulted: { resultedAt: now },
				reviewed: { reviewedAt: now },
				rejected: { closedAt: now, statusReason: reason },
				cancelled: { closedAt: now, statusReason: reason },
			}[to as string] ?? {};
		if (!(await this.orders.transition(tx, order.id, order.status, { status: to, ...stamp }))) {
			throw new HandlerError('CONFLICT', 'Someone else updated this order just now. Reload and try again.');
		}
		const isLabStep = ORDER_STEPS[step].actor !== 'orderer';
		await this.audit.write(tx, {
			userId: 'userId' in actor ? actor.userId : null,
			orgId:
				'userId' in actor
					? isLabStep
						? order.targetOrgId
						: order.orderingOrgId
					: (actor.orgId ?? order.targetOrgId),
			patientId: order.patientId,
			action: `order.${ORDER_STEPS[step].verb}`,
			resource: 'clinical_order',
			resourceId: order.id,
			reason,
			origin: 'system' in actor ? { via: 'hl7' } : (wiseOrigin ?? null),
		});
		const updated = await this.orders.findById(tx, order.id);
		return toClinicalOrder(updated ?? { ...order, status: to });
	}

	/** Queues an ORM^O01 for the target facility when its lab system takes orders through the edge connector. */
	private async enqueueHl7(tx: Tx, orderId: string, orderControl: OrderControl): Promise<void> {
		const order = await this.orders.findOutbound(tx, orderId);
		if (!order?.targetOrg.usesHl7Connector) {
			return;
		}
		const controlId = hl7ControlId();
		await this.orders.enqueueHl7(tx, {
			orgId: order.targetOrgId,
			orderId: order.id,
			messageType: 'ORM^O01',
			controlId,
			message: buildOrmO01(ormInput(order, controlId, orderControl)),
		});
	}

	private async facilityIds(userId: string): Promise<string[]> {
		return (await this.organizations.getUserFacilities(userId)).map((facility) => facility.id);
	}
}

function requireReason(reason: string): string {
	const trimmed = reason.trim();
	if (!trimmed) {
		throw new HandlerError('BAD_REQUEST', 'Give a reason.');
	}
	return trimmed;
}

function ormInput(order: OutboundOrderRow, controlId: string, orderControl: OrderControl) {
	return {
		controlId,
		at: new Date(),
		orderControl,
		sending: order.orderingOrg,
		receiving: order.targetOrg,
		patient: {
			id: order.patient.id,
			familyName: order.patient.familyName,
			givenName: order.patient.givenName,
			birthDate: order.patient.birthDate,
			sex: order.patient.sex,
			phone: order.patient.phone,
			identifiers: order.patient.identifiers.map((identifier) => ({
				system: identifier.system,
				value: identifier.value,
				facilitySlug: identifier.organization.slug,
			})),
		},
		order: {
			id: order.id,
			code: order.code,
			codeSystem: order.codeSystem,
			display: order.display,
			priority: order.priority,
			notes: order.notes,
			createdAt: order.createdAt,
		},
		orderingProvider: order.orderingDoctor,
	};
}
