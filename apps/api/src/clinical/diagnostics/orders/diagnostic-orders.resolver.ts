import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../../auth/auth.service.js';
import { CurrentUser } from '../../../common/decorators/current.decorator.js';
import { DiagnosticOrderService } from './diagnostic-order.service.js';
import { CancelDiagnosticOrderInput, CreateDiagnosticOrderInput } from './dto/diagnostic-order.input.js';
import { DiagnosticOrder } from './models/diagnostic-order.model.js';

/** A visit's lab and imaging requests. Access is row-level security plus the checks in `DiagnosticOrderService`. */
@Resolver(() => DiagnosticOrder)
export class DiagnosticOrdersResolver {
	constructor(private readonly orders: DiagnosticOrderService) {}

	@Query(() => [DiagnosticOrder], { description: "The visit's orders with their tests and results, oldest first." })
	encounterDiagnosticOrders(
		@CurrentUser() user: AuthUser,
		@Args('encounterId', { type: () => ID }) encounterId: string,
	): Promise<DiagnosticOrder[]> {
		return this.orders.listForEncounter(user.id, encounterId);
	}

	@Mutation(() => DiagnosticOrder, {
		description: 'Requests tests for the visit: one order, one item per test (a Wise `propose_order` card too).',
	})
	createDiagnosticOrder(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CreateDiagnosticOrderInput,
	): Promise<DiagnosticOrder> {
		return this.orders.create(user.id, input);
	}

	@Mutation(() => DiagnosticOrder, {
		description: 'Cancels one test of the order (or every test still open) before its result, with the reason.',
	})
	cancelDiagnosticOrder(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CancelDiagnosticOrderInput,
	): Promise<DiagnosticOrder> {
		return this.orders.cancel(user.id, input);
	}
}
