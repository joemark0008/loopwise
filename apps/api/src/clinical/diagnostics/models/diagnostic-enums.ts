import { registerEnumType } from '@nestjs/graphql';

import {
	DiagnosticCategory,
	DiagnosticOrderStatus,
	OrderPriority,
	ResultFlag,
	ResultValueType,
} from '../../../generated/prisma/enums.js';

/** The diagnostics domain's enums, registered once for GraphQL (schema `diagnostics.prisma`). */
registerEnumType(DiagnosticCategory, {
	name: 'DiagnosticCategory',
	description: 'Laboratory, imaging, cardio (ECG, 2D echo) or other.',
});
registerEnumType(ResultValueType, {
	name: 'ResultValueType',
	description: 'A numeric analyte, free text, or one of fixed options (Positive / Negative …).',
});
registerEnumType(OrderPriority, { name: 'OrderPriority' });
registerEnumType(DiagnosticOrderStatus, {
	name: 'DiagnosticOrderStatus',
	description:
		'REQUESTED → (PAID) → SPECIMEN_COLLECTED → IN_PROGRESS → RESULTED → RELEASED, or CANCELLED before the result; ' +
		'a result that needs correcting goes back to IN_PROGRESS.',
});
registerEnumType(ResultFlag, { name: 'ResultFlag', description: "A value against the test's reference range." });

/** How urgently a released result needs the doctor's eyes; the results inbox sorts by it. Derived from the flags. */
export enum ResultUrgency {
	CRITICAL = 'CRITICAL',
	ABNORMAL = 'ABNORMAL',
	/** No flag (an imaging report, a text result): read it. */
	UNFLAGGED = 'UNFLAGGED',
	NORMAL = 'NORMAL',
}
registerEnumType(ResultUrgency, { name: 'ResultUrgency' });

export { DiagnosticCategory, DiagnosticOrderStatus, OrderPriority, ResultFlag, ResultValueType };
