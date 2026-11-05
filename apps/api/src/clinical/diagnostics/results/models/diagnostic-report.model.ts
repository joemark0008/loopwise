import { Field, ID, ObjectType } from '@nestjs/graphql';

import { DiagnosticTest, toDiagnosticTest } from '../../catalog/models/diagnostic-test.model.js';
import type { ReportRow } from '../../diagnostic.includes.js';
import { DiagnosticOrderStatus } from '../../models/diagnostic-enums.js';
import {
	DiagnosticPatient,
	DiagnosticResult,
	toDiagnosticPatient,
	toDiagnosticResult,
} from '../../models/diagnostic-result.model.js';
import { DiagnosticOrderSummary, toDiagnosticOrderSummary } from '../../orders/models/diagnostic-order.model.js';

@ObjectType({
	description:
		'A result with its test, request and patient (FHIR DiagnosticReport): a row of the results inbox and of the ' +
		"patient's results.",
})
export class DiagnosticReport extends DiagnosticResult {
	@Field(() => ID)
	orderItemId: string;

	@Field(() => DiagnosticOrderStatus, { description: "The test's status: RESULTED, RELEASED, or IN_PROGRESS again." })
	status: DiagnosticOrderStatus;

	@Field(() => DiagnosticTest)
	test: DiagnosticTest;

	@Field(() => DiagnosticOrderSummary)
	order: DiagnosticOrderSummary;

	@Field(() => DiagnosticPatient)
	patient: DiagnosticPatient;

	@Field({ description: 'The clinic whose lab did the test.' })
	clinicName: string;
}

export function toDiagnosticReport(row: ReportRow): DiagnosticReport {
	const item = row.orderItem;
	return {
		...toDiagnosticResult(row, item.test.lisCode),
		orderItemId: item.id,
		status: item.status,
		test: toDiagnosticTest(item.test),
		order: toDiagnosticOrderSummary(item.order),
		patient: toDiagnosticPatient(item.order.encounter.patient),
		clinicName: item.order.encounter.clinic.name,
	};
}
