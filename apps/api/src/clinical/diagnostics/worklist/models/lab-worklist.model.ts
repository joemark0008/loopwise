import { Field, Int, ObjectType } from '@nestjs/graphql';

import type { ItemRow } from '../../diagnostic.includes.js';
import { DiagnosticOrderStatus } from '../../models/diagnostic-enums.js';
import { DiagnosticPatient, toDiagnosticPatient } from '../../models/diagnostic-result.model.js';
import {
	DiagnosticOrderItem,
	DiagnosticOrderSummary,
	toDiagnosticOrderItem,
	toDiagnosticOrderSummary,
} from '../../orders/models/diagnostic-order.model.js';

@ObjectType({ description: "A test on the clinic's lab worklist, with its request and patient." })
export class LabWorklistItem extends DiagnosticOrderItem {
	@Field(() => DiagnosticOrderSummary)
	order: DiagnosticOrderSummary;

	@Field(() => DiagnosticPatient)
	patient: DiagnosticPatient;
}

@ObjectType({ description: 'How many tests of the lab worklist are at one step (the worklist tabs).' })
export class LabWorklistCount {
	@Field(() => DiagnosticOrderStatus)
	status: DiagnosticOrderStatus;

	@Field(() => Int)
	count: number;
}

export function toLabWorklistItem(row: ItemRow): LabWorklistItem {
	return {
		...toDiagnosticOrderItem(row),
		order: toDiagnosticOrderSummary(row.order),
		patient: toDiagnosticPatient(row.order.encounter.patient),
	};
}
