import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { Prisma } from '../../../generated/prisma/client.js';
import { OrderPriority, OrderStatus, ResultFlag } from '../../../generated/prisma/enums.js';

registerEnumType(OrderPriority, { name: 'OrderPriority' });
registerEnumType(OrderStatus, { name: 'OrderStatus' });
registerEnumType(ResultFlag, { name: 'ResultFlag' });

@ObjectType({ description: 'A lab or imaging result (DESIGN.md §5).' })
export class OrderResult {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field(() => String, { nullable: true })
	display: string | null;

	@Field()
	value: string;

	@Field(() => String, { nullable: true })
	unit: string | null;

	@Field(() => String, { nullable: true })
	refRange: string | null;

	@Field(() => ResultFlag, { nullable: true })
	flag: ResultFlag | null;

	@Field()
	resultedAt: Date;

	@Field(() => Date, { nullable: true })
	reviewedAt: Date | null;
}

@ObjectType({ description: 'A test ordered for the patient (FHIR ServiceRequest), with its results.' })
export class ClinicalOrder {
	@Field(() => ID)
	id: string;

	@Field(() => ID, { nullable: true })
	encounterId: string | null;

	@Field()
	code: string;

	@Field()
	codeSystem: string;

	@Field(() => String, { nullable: true })
	display: string | null;

	@Field(() => OrderPriority)
	priority: OrderPriority;

	@Field(() => OrderStatus)
	status: OrderStatus;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => Date, { nullable: true })
	sentAt: Date | null;

	@Field(() => Date, { nullable: true })
	acceptedAt: Date | null;

	@Field(() => Date, { nullable: true })
	collectedAt: Date | null;

	@Field(() => Date, { nullable: true })
	resultedAt: Date | null;

	@Field(() => Date, { nullable: true })
	reviewedAt: Date | null;

	@Field(() => Date, { nullable: true, description: 'When it was rejected or cancelled.' })
	closedAt: Date | null;

	@Field(() => String, { nullable: true, description: 'Why it was rejected or cancelled.' })
	statusReason: string | null;

	@Field()
	createdAt: Date;

	@Field(() => [OrderResult])
	results: OrderResult[];

	/** Resolved by `OrdersResolver.targetFacility`. */
	targetOrgId: string;
}

export type OrderRow = Prisma.ClinicalOrderGetPayload<{ include: { results: true } }>;

export type LabOrderRow = Prisma.ClinicalOrderGetPayload<{
	include: {
		patient: { select: { id: true; givenName: true; familyName: true; birthDate: true; sex: true } };
		orderingDoctor: { select: { id: true; name: true } };
		orderingOrg: { select: { id: true; name: true; slug: true } };
	};
}>;

export function toClinicalOrder(row: OrderRow): ClinicalOrder {
	return {
		id: row.id,
		encounterId: row.encounterId,
		code: row.code,
		codeSystem: row.codeSystem,
		display: row.display,
		priority: row.priority,
		status: row.status,
		notes: row.notes,
		sentAt: row.sentAt,
		acceptedAt: row.acceptedAt,
		collectedAt: row.collectedAt,
		resultedAt: row.resultedAt,
		reviewedAt: row.reviewedAt,
		closedAt: row.closedAt,
		statusReason: row.statusReason,
		createdAt: row.createdAt,
		targetOrgId: row.targetOrgId,
		results: row.results
			.sort((a, b) => a.resultedAt.getTime() - b.resultedAt.getTime())
			.map((result) => ({
				id: result.id,
				code: result.code,
				display: result.display,
				value: result.value,
				unit: result.unit,
				refRange: result.refRange,
				flag: result.flag,
				resultedAt: result.resultedAt,
				reviewedAt: result.reviewedAt,
			})),
	};
}

@ObjectType({ description: 'A test that can be ordered from an encounter (LOINC).' })
export class OrderableTest {
	@Field()
	code: string;

	@Field()
	display: string;

	@Field({ description: '`lab` or `imaging`.' })
	kind: string;
}

@ObjectType({ description: 'The patient as the lab sees them on its worklist.' })
export class LabOrderPatient {
	@Field(() => ID)
	id: string;

	@Field()
	givenName: string;

	@Field()
	familyName: string;

	@Field()
	birthDate: string;

	@Field()
	sex: string;
}

@ObjectType({ description: "An order on the receiving facility's worklist (DESIGN.md §2 steps 2–4)." })
export class LabOrder {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field(() => String, { nullable: true })
	display: string | null;

	@Field(() => OrderPriority)
	priority: OrderPriority;

	@Field(() => OrderStatus)
	status: OrderStatus;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field(() => Date, { nullable: true })
	sentAt: Date | null;

	@Field(() => Date, { nullable: true })
	acceptedAt: Date | null;

	@Field(() => Date, { nullable: true })
	collectedAt: Date | null;

	@Field(() => Date, { nullable: true })
	resultedAt: Date | null;

	@Field()
	createdAt: Date;

	@Field(() => LabOrderPatient)
	patient: LabOrderPatient;

	@Field()
	orderingDoctorName: string;

	@Field()
	orderingFacilityName: string;

	@Field(() => ID)
	targetOrgId: string;
}

export function toLabOrder(row: LabOrderRow): LabOrder {
	return {
		id: row.id,
		code: row.code,
		display: row.display,
		priority: row.priority,
		status: row.status,
		notes: row.notes,
		sentAt: row.sentAt,
		acceptedAt: row.acceptedAt,
		collectedAt: row.collectedAt,
		resultedAt: row.resultedAt,
		createdAt: row.createdAt,
		patient: {
			id: row.patient.id,
			givenName: row.patient.givenName,
			familyName: row.patient.familyName,
			birthDate: row.patient.birthDate.toISOString().slice(0, 10),
			sex: row.patient.sex,
		},
		orderingDoctorName: row.orderingDoctor.name,
		orderingFacilityName: row.orderingOrg.name,
		targetOrgId: row.targetOrgId,
	};
}

@ObjectType({ description: 'How many orders the facility has in one status (the worklist tabs).' })
export class LabOrderCount {
	@Field(() => OrderStatus)
	status: OrderStatus;

	@Field(() => Int)
	count: number;
}
