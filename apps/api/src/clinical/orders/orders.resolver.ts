import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';

import type { AuthUser } from '../../auth/auth.service.js';
import { Loaders } from '../../common/dataloader/loaders.decorator.js';
import type { RequestLoaders } from '../../common/dataloader/request-loaders.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { OrderStatus } from '../../generated/prisma/enums.js';
import { Facility } from '../patients/models/patient.model.js';
import { FacilityLoader } from '../patients/patient.loader.js';
import { WiseOriginInput } from '../wise-proposals/dto/wise-origin.input.js';
import { CreateEncounterOrderInput, CreateEncounterOrdersInput } from './dto/order.input.js';
import { OrderReasonInput } from './dto/order-step.input.js';
import { ClinicalOrder, LabOrder, LabOrderCount, OrderableTest } from './models/order.model.js';
import { OrderService } from './order.service.js';

/**
 * Orders from an encounter, and the receiving facility's worklist. Access is row-level security plus the facility and
 * ordering-doctor checks in `OrderService`.
 */
@Resolver(() => ClinicalOrder)
export class OrdersResolver {
	constructor(private readonly service: OrderService) {}

	@Query(() => [OrderableTest], { description: 'The tests that can be ordered from an encounter.' })
	orderableTests(): readonly OrderableTest[] {
		return this.service.orderableTests();
	}

	@Query(() => [Facility], { description: 'Labs, imaging centers and hospitals that receive orders.' })
	orderTargets(@CurrentUser() user: AuthUser): Promise<Facility[]> {
		return this.service.orderTargets(user.id);
	}

	@Mutation(() => ClinicalOrder, { description: 'Orders a test from the encounter and sends it to the facility.' })
	createEncounterOrder(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CreateEncounterOrderInput,
	): Promise<ClinicalOrder> {
		return this.service.createForEncounter(user.id, input);
	}

	@Mutation(() => [ClinicalOrder], {
		description:
			'Orders several tests from the encounter to one facility, all or none (a Wise `propose_order` card).',
	})
	createEncounterOrders(
		@CurrentUser() user: AuthUser,
		@Args('input') input: CreateEncounterOrdersInput,
	): Promise<ClinicalOrder[]> {
		return this.service.createManyForEncounter(user.id, input);
	}

	@Query(() => [LabOrder], { description: "Orders sent to the user's facilities in one status, oldest first." })
	labOrders(
		@CurrentUser() user: AuthUser,
		@Args('status', { type: () => OrderStatus }) status: OrderStatus,
	): Promise<LabOrder[]> {
		return this.service.labOrders(user.id, status);
	}

	@Query(() => [LabOrderCount], { description: 'How many orders each worklist tab holds.' })
	labOrderCounts(@CurrentUser() user: AuthUser): Promise<LabOrderCount[]> {
		return this.service.labOrderCounts(user.id);
	}

	@Mutation(() => ClinicalOrder, { description: 'The receiving facility accepts the order.' })
	acceptOrder(
		@CurrentUser() user: AuthUser,
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalOrder> {
		return this.service.accept(user.id, orderId, wiseOrigin);
	}

	@Mutation(() => ClinicalOrder, { description: 'The receiving facility refuses the order, with a reason.' })
	rejectOrder(@CurrentUser() user: AuthUser, @Args('input') input: OrderReasonInput): Promise<ClinicalOrder> {
		return this.service.reject(user.id, input.orderId, input.reason, input.wiseOrigin);
	}

	@Mutation(() => ClinicalOrder, { description: 'The receiving facility took the specimen.' })
	markOrderCollected(
		@CurrentUser() user: AuthUser,
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('wiseOrigin', { type: () => WiseOriginInput, nullable: true }) wiseOrigin?: WiseOriginInput | null,
	): Promise<ClinicalOrder> {
		return this.service.markCollected(user.id, orderId, wiseOrigin);
	}

	@Mutation(() => ClinicalOrder, { description: 'The ordering doctor withdraws the order before collection.' })
	cancelOrder(@CurrentUser() user: AuthUser, @Args('input') input: OrderReasonInput): Promise<ClinicalOrder> {
		return this.service.cancel(user.id, input.orderId, input.reason, input.wiseOrigin);
	}

	@ResolveField(() => Facility, { nullable: true })
	targetFacility(@Parent() order: ClinicalOrder, @Loaders() loaders: RequestLoaders): Promise<Facility | null> {
		return loaders.get(FacilityLoader).load(order.targetOrgId);
	}
}
