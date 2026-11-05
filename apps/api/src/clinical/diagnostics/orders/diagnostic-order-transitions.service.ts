import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, InvalidStatusTransitionError } from '../../../common/errors/domain-error.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { DiagnosticOrderStatus } from '../../../generated/prisma/enums.js';
import type { ClinicalTx } from '../../rls/clinical-db.service.js';
import { DiagnosticItemChangedError } from '../diagnostics.errors.js';
import { DiagnosticOrderRepository } from './diagnostic-order.repository.js';
import { assertTransition, deriveOrderStatus, transitionPath } from './diagnostic-order-status.js';

/**
 * The one way a diagnostic test changes status (the `check_diagnostic_order_transition` trigger guards the same edges
 * in Postgres). Each move is checked against `diagnostic-order-status.ts`, written only if nobody moved
 * the test meanwhile, and the order header follows its tests in the same transaction.
 */
@Injectable()
export class DiagnosticOrderTransitions {
	constructor(private readonly orders: DiagnosticOrderRepository) {}

	/** Moves one test to `to`, stamping `data` (who collected it, why it was cancelled …), then syncs its order. */
	async moveItem(
		tx: ClinicalTx,
		item: { id: string; orderId: string; status: DiagnosticOrderStatus },
		to: DiagnosticOrderStatus,
		data: Prisma.DiagnosticOrderItemUncheckedUpdateManyInput = {},
	): Promise<void> {
		assertTransition('DiagnosticOrderItem', item.status, to);
		if (!(await this.orders.transitionItem(tx, item.id, item.status, { ...data, status: to }))) {
			throw new DiagnosticItemChangedError();
		}
		await this.syncOrder(tx, item.orderId);
	}

	/**
	 * Brings the order header to the status its tests give it (`deriveOrderStatus`), one allowed move at a time: a
	 * header may need two moves when its tests jumped further (REQUESTED → RESULTED → RELEASED).
	 */
	async syncOrder(tx: ClinicalTx, orderId: string): Promise<DiagnosticOrderStatus> {
		const current = await this.orders.findStatuses(tx, orderId);
		if (!current) {
			throw new EntityNotFoundError('DiagnosticOrder', orderId);
		}
		const target = deriveOrderStatus(current.items);
		const path = transitionPath(current.status, target);
		if (!path) {
			throw new InvalidStatusTransitionError('DiagnosticOrder', current.status, target);
		}
		let status = current.status;
		for (const next of path) {
			if (!(await this.orders.setStatus(tx, orderId, status, next))) {
				throw new DiagnosticItemChangedError();
			}
			status = next;
		}
		return status;
	}
}
