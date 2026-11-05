import { Field, ID, ObjectType } from '@nestjs/graphql';

import { DiagnosticTest, toDiagnosticTest } from '../../catalog/models/diagnostic-test.model.js';
import type { ItemRow, OrderHeaderRow, OrderRow } from '../../diagnostic.includes.js';
import { DiagnosticOrderStatus, OrderPriority } from '../../models/diagnostic-enums.js';
import { DiagnosticResult, practitionerName, toDiagnosticResult } from '../../models/diagnostic-result.model.js';

@ObjectType({ description: 'One ordered test, with its own status and, once entered, its result.' })
export class DiagnosticOrderItem {
	@Field(() => ID)
	id: string;

	@Field(() => DiagnosticOrderStatus)
	status: DiagnosticOrderStatus;

	@Field(() => DiagnosticTest)
	test: DiagnosticTest;

	@Field(() => String, { nullable: true, description: 'The specimen label (barcode / accession number).' })
	accessionNo: string | null;

	@Field(() => Date, { nullable: true })
	specimenCollectedAt: Date | null;

	@Field(() => String, { nullable: true, description: 'Why it was cancelled.' })
	statusReason: string | null;

	@Field(() => Date, { nullable: true })
	cancelledAt: Date | null;

	@Field(() => DiagnosticResult, { nullable: true })
	result: DiagnosticResult | null;
}

@ObjectType({ description: 'The request header of an order: its number, priority and requesting physician.' })
export class DiagnosticOrderSummary {
	@Field(() => ID)
	id: string;

	@Field({ description: 'E.g. `TAG-LAB-2026-000042` (per clinic, yearly).' })
	orderNo: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => OrderPriority)
	priority: OrderPriority;

	@Field(() => DiagnosticOrderStatus, {
		description: 'Derived from its tests: the least advanced one still running.',
	})
	status: DiagnosticOrderStatus;

	@Field(() => String, { nullable: true, description: 'The indication printed on the request.' })
	clinicalInfo: string | null;

	@Field({ description: 'The test is to be done outside the clinic (the request is printed).' })
	isExternal: boolean;

	@Field(() => String, { nullable: true, description: 'The outside doctor of a walk-in lab request.' })
	externalPhysician: string | null;

	@Field(() => String, { nullable: true, description: 'The requesting practitioner, e.g. "Dr. Ana Reyes".' })
	requestedByName: string | null;

	@Field()
	createdAt: Date;
}

@ObjectType({ description: 'A lab or imaging request of a visit (one order, one item per test).' })
export class DiagnosticOrder extends DiagnosticOrderSummary {
	@Field(() => [DiagnosticOrderItem])
	items: DiagnosticOrderItem[];
}

export function toDiagnosticOrderSummary(row: Omit<OrderHeaderRow, 'encounter'>): DiagnosticOrderSummary {
	return {
		id: row.id,
		orderNo: row.orderNo,
		encounterId: row.encounterId,
		priority: row.priority,
		status: row.status,
		clinicalInfo: row.clinicalInfo,
		isExternal: row.isExternal,
		externalPhysician: row.externalPhysician,
		requestedByName: row.requestedBy ? practitionerName(row.requestedBy) : null,
		createdAt: row.createdAt,
	};
}

export function toDiagnosticOrderItem(row: Omit<ItemRow, 'order'>): DiagnosticOrderItem {
	return {
		id: row.id,
		status: row.status,
		test: toDiagnosticTest(row.test),
		accessionNo: row.accessionNo,
		specimenCollectedAt: row.specimenCollectedAt,
		statusReason: row.statusReason,
		cancelledAt: row.cancelledAt,
		result: row.result ? toDiagnosticResult(row.result, row.test.lisCode) : null,
	};
}

export function toDiagnosticOrder(row: OrderRow): DiagnosticOrder {
	return { ...toDiagnosticOrderSummary(row), items: row.items.map(toDiagnosticOrderItem) };
}
