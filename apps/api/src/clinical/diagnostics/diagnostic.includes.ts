import type { Prisma } from '../../generated/prisma/client.js';

/**
 * The shapes the diagnostics repositories read (Prisma `include`s) and the row types the models map from. A test is
 * always read with its parameters (the worklist enters results against them); a result with its values; an order with
 * its requesting practitioner and the visit's clinic, patient and doctor.
 */

export const TEST_INCLUDE = {
	parameters: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.DiagnosticTestInclude;

export const RESULT_INCLUDE = {
	values: { include: { parameter: { select: { sortOrder: true, lisCode: true } } } },
} as const satisfies Prisma.DiagnosticResultInclude;

const PRACTITIONER_NAME = { select: { id: true, userId: true, title: true, firstName: true, lastName: true } } as const;

export const ORDER_HEADER_INCLUDE = {
	requestedBy: PRACTITIONER_NAME,
	encounter: {
		select: {
			id: true,
			encounterNo: true,
			clinicId: true,
			patientId: true,
			clinic: { select: { id: true, code: true, name: true, organizationId: true } },
			patient: {
				select: {
					id: true,
					patientNo: true,
					firstName: true,
					lastName: true,
					middleName: true,
					birthDate: true,
					sex: true,
				},
			},
			practitioner: PRACTITIONER_NAME,
		},
	},
} as const satisfies Prisma.DiagnosticOrderInclude;

/** One test of an order with everything the worklist and the results inbox show. */
export const ITEM_INCLUDE = {
	test: { include: TEST_INCLUDE },
	result: { include: RESULT_INCLUDE },
	order: { include: ORDER_HEADER_INCLUDE },
} as const satisfies Prisma.DiagnosticOrderItemInclude;

/** An order with its tests and their results (the encounter's orders tab). */
export const ORDER_INCLUDE = {
	...ORDER_HEADER_INCLUDE,
	items: {
		include: { test: { include: TEST_INCLUDE }, result: { include: RESULT_INCLUDE } },
		orderBy: { id: 'asc' },
	},
} as const satisfies Prisma.DiagnosticOrderInclude;

export type ResultRow = Prisma.DiagnosticResultGetPayload<{ include: typeof RESULT_INCLUDE }>;
export type OrderHeaderRow = Prisma.DiagnosticOrderGetPayload<{ include: typeof ORDER_HEADER_INCLUDE }>;
export type ItemRow = Prisma.DiagnosticOrderItemGetPayload<{ include: typeof ITEM_INCLUDE }>;
export type OrderRow = Prisma.DiagnosticOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
export type ReportRow = Prisma.DiagnosticResultGetPayload<{
	include: typeof RESULT_INCLUDE & { orderItem: { include: typeof ITEM_INCLUDE } };
}>;
export type PatientRow = OrderHeaderRow['encounter']['patient'];
export type PractitionerNameRow = NonNullable<OrderHeaderRow['requestedBy']>;

export const REPORT_INCLUDE = {
	...RESULT_INCLUDE,
	orderItem: { include: ITEM_INCLUDE },
} as const satisfies Prisma.DiagnosticResultInclude;
