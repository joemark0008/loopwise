import { Injectable } from '@nestjs/common';

import type { Organization, Prisma } from '../../generated/prisma/client.js';
import type { OrderStatus } from '../../generated/prisma/enums.js';
import type { LabOrderRow, OrderRow } from './models/order.model.js';

type Tx = Prisma.TransactionClient;

/** The facilities that receive orders. */
export const ORDER_TARGET_TYPES = ['lab', 'imaging', 'hospital'] as const;

const LAB_ORDER_INCLUDE = {
	patient: { select: { id: true, givenName: true, familyName: true, birthDate: true, sex: true } },
	orderingDoctor: { select: { id: true, name: true } },
	orderingOrg: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.ClinicalOrderInclude;

/** What an outbound ORM message needs: the patient with identifiers, both facilities and the ordering doctor. */
const OUTBOUND_INCLUDE = {
	patient: { include: { identifiers: { include: { organization: { select: { slug: true } } } } } },
	orderingDoctor: { select: { id: true, name: true } },
	orderingOrg: { select: { id: true, name: true, slug: true } },
	targetOrg: { select: { id: true, name: true, slug: true, usesHl7Connector: true } },
} as const satisfies Prisma.ClinicalOrderInclude;

export type OutboundOrderRow = Prisma.ClinicalOrderGetPayload<{ include: typeof OUTBOUND_INCLUDE }>;

/** Clinical orders. Every method takes the transaction of `ClinicalDbService.asUser`, so row-level security applies. */
@Injectable()
export class OrderRepository {
	listTargets(tx: Tx): Promise<Organization[]> {
		return tx.organization.findMany({ where: { type: { in: [...ORDER_TARGET_TYPES] } }, orderBy: { name: 'asc' } });
	}

	findTarget(tx: Tx, id: string): Promise<Organization | null> {
		return tx.organization.findFirst({ where: { id, type: { in: [...ORDER_TARGET_TYPES] } } });
	}

	create(tx: Tx, data: Prisma.ClinicalOrderUncheckedCreateInput): Promise<OrderRow> {
		return tx.clinicalOrder.create({ data, include: { results: true } });
	}

	findById(tx: Tx, id: string): Promise<OrderRow | null> {
		return tx.clinicalOrder.findUnique({ where: { id }, include: { results: true } });
	}

	/** The order with what an HL7 message about it needs. */
	findOutbound(tx: Tx, id: string): Promise<OutboundOrderRow | null> {
		return tx.clinicalOrder.findUnique({ where: { id }, include: OUTBOUND_INCLUDE });
	}

	/**
	 * Moves the order from `from` to another status. Conditional on `from`, so two people acting at once can't both
	 * win; false when the order moved in between.
	 */
	async transition(
		tx: Tx,
		id: string,
		from: OrderStatus,
		data: Prisma.ClinicalOrderUncheckedUpdateManyInput,
	): Promise<boolean> {
		const { count } = await tx.clinicalOrder.updateMany({ where: { id, status: from }, data });
		return count === 1;
	}

	/** Orders sent to the facilities, oldest first (the lab works first in, first out; stat orders sort on top later). */
	listForTargets(tx: Tx, orgIds: readonly string[], statuses: readonly OrderStatus[]): Promise<LabOrderRow[]> {
		return tx.clinicalOrder.findMany({
			where: { targetOrgId: { in: [...orgIds] }, status: { in: [...statuses] } },
			include: LAB_ORDER_INCLUDE,
			orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
			take: 200,
		});
	}

	countByStatusForTargets(tx: Tx, orgIds: readonly string[]) {
		return tx.clinicalOrder.groupBy({
			by: ['status'],
			where: { targetOrgId: { in: [...orgIds] } },
			_count: { _all: true },
		});
	}

	/** Queues an outbound HL7 message. `createMany`: users may insert outbox rows but not read them back. */
	async enqueueHl7(tx: Tx, data: Prisma.Hl7OutboxUncheckedCreateInput): Promise<void> {
		await tx.hl7Outbox.createMany({ data: [data] });
	}

	/** The user of an `asUser` transaction (`app.user_id`), or null in system work. */
	async currentUserId(tx: Tx): Promise<string | null> {
		const [row] = await tx.$queryRaw<{ id: string | null }[]>`SELECT app_user_id() AS id`;
		return row?.id ?? null;
	}

	countUnreviewedResults(tx: Tx, orderId: string): Promise<number> {
		return tx.result.count({ where: { orderId, reviewedAt: null } });
	}
}
