import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { DiagnosticOrderStatus, OrderPriority } from '../../../generated/prisma/enums.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { ITEM_INCLUDE, type ItemRow, ORDER_INCLUDE, type OrderRow } from '../diagnostic.includes.js';

/** What ordering needs to know about the visit: its clinic (numbering, catalog) and patient. */
export interface OrderingEncounter {
	id: string;
	encounterNo: string;
	status: string;
	patientId: string;
	clinic: { id: string; code: string; organizationId: string };
}

export interface NewDiagnosticOrder {
	orderNo: string;
	encounterId: string;
	requestedById: string | null;
	externalPhysician: string | null;
	priority: OrderPriority;
	clinicalInfo: string | null;
	isExternal: boolean;
	testIds: readonly string[];
}

/**
 * Diagnostic orders and their items (`diagnostic_orders`, `diagnostic_order_items`). Every method takes the caller's
 * transaction (`ClinicalDbService.asUser`), so row-level security decides what is visible: a visit's orders through
 * the encounter (`app_can_see_encounter`), and writes only at the user's clinics (`app_can_write_encounter`).
 */
@Injectable()
export class DiagnosticOrderRepository {
	/** The visit an order goes on, as the user sees it; null when hidden or missing. */
	findOrderingEncounter(tx: ClinicalTx, encounterId: string): Promise<OrderingEncounter | null> {
		return tx.encounter.findUnique({
			where: { id: encounterId },
			select: {
				id: true,
				encounterNo: true,
				status: true,
				patientId: true,
				clinic: { select: { id: true, code: true, organizationId: true } },
			},
		});
	}

	/** The signed-in user's practitioner record (the requesting physician), if they have one. */
	async findPractitionerIdOfUser(tx: ClinicalTx, userId: string): Promise<string | null> {
		return (await tx.practitioner.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
	}

	create(tx: ClinicalTx, order: NewDiagnosticOrder): Promise<OrderRow> {
		return tx.diagnosticOrder.create({
			data: {
				orderNo: order.orderNo,
				encounterId: order.encounterId,
				requestedById: order.requestedById,
				externalPhysician: order.externalPhysician,
				priority: order.priority,
				clinicalInfo: order.clinicalInfo,
				isExternal: order.isExternal,
				items: { create: order.testIds.map((testId) => ({ testId })) },
			},
			include: ORDER_INCLUDE,
		});
	}

	findById(tx: ClinicalTx, id: string): Promise<OrderRow | null> {
		return tx.diagnosticOrder.findUnique({ where: { id }, include: ORDER_INCLUDE });
	}

	listForEncounter(tx: ClinicalTx, encounterId: string): Promise<OrderRow[]> {
		return tx.diagnosticOrder.findMany({
			where: { encounterId },
			include: ORDER_INCLUDE,
			orderBy: { createdAt: 'asc' },
		});
	}

	findItem(tx: ClinicalTx, itemId: string): Promise<ItemRow | null> {
		return tx.diagnosticOrderItem.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
	}

	/** Moves an item from `from` (unless someone moved it meanwhile); true when it moved. */
	async transitionItem(
		tx: ClinicalTx,
		itemId: string,
		from: DiagnosticOrderStatus,
		data: Prisma.DiagnosticOrderItemUncheckedUpdateManyInput & { status: DiagnosticOrderStatus },
	): Promise<boolean> {
		const { count } = await tx.diagnosticOrderItem.updateMany({ where: { id: itemId, status: from }, data });
		return count === 1;
	}

	/** The header's status and its items' statuses. */
	async findStatuses(
		tx: ClinicalTx,
		orderId: string,
	): Promise<{ status: DiagnosticOrderStatus; items: DiagnosticOrderStatus[] } | null> {
		const row = await tx.diagnosticOrder.findUnique({
			where: { id: orderId },
			select: { status: true, items: { select: { status: true } } },
		});
		return row ? { status: row.status, items: row.items.map((item) => item.status) } : null;
	}

	async setStatus(
		tx: ClinicalTx,
		orderId: string,
		from: DiagnosticOrderStatus,
		to: DiagnosticOrderStatus,
	): Promise<boolean> {
		const { count } = await tx.diagnosticOrder.updateMany({
			where: { id: orderId, status: from },
			data: { status: to },
		});
		return count === 1;
	}
}
