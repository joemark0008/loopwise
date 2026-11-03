import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { OrderPriority, OrderStatus, ResultFlag, Sex } from '../../../generated/prisma/enums.js';
import { Facility } from '../../patients/models/patient.model.js';

/** How urgently a result needs a clinician's eyes; the inbox sorts by it. Derived from the flag. */
export enum ResultUrgency {
	critical = 'critical',
	abnormal = 'abnormal',
	normal = 'normal',
	/** No flag sent (e.g. a text report): read it. */
	unflagged = 'unflagged',
}
registerEnumType(ResultUrgency, { name: 'ResultUrgency' });

@ObjectType({ description: 'The patient a result belongs to, as the inbox shows them.' })
export class ResultPatient {
	@Field(() => ID)
	id: string;

	@Field()
	givenName: string;

	@Field()
	familyName: string;

	@Field({ description: '`YYYY-MM-DD`.' })
	birthDate: string;

	@Field(() => Sex)
	sex: Sex;
}

@ObjectType({ description: 'A lab or imaging result with its patient, source and order (DESIGN.md §4.1 steps 5–6).' })
export class ResultItem {
	@Field(() => ID)
	id: string;

	@Field()
	code: string;

	@Field()
	codeSystem: string;

	@Field(() => String, { nullable: true })
	display: string | null;

	@Field({ description: 'The value as sent; a report text for radiology.' })
	value: string;

	@Field(() => String, { nullable: true })
	unit: string | null;

	@Field(() => String, { nullable: true })
	refRange: string | null;

	@Field(() => ResultFlag, { nullable: true })
	flag: ResultFlag | null;

	@Field(() => ResultUrgency)
	urgency: ResultUrgency;

	@Field()
	resultedAt: Date;

	@Field()
	receivedAt: Date;

	@Field(() => Date, { nullable: true })
	reviewedAt: Date | null;

	@Field(() => ResultPatient)
	patient: ResultPatient;

	@Field(() => Facility, { description: 'The lab or imaging facility that sent it.' })
	sourceFacility: Facility;

	@Field(() => ID, { nullable: true })
	orderId: string | null;

	@Field(() => OrderStatus, { nullable: true })
	orderStatus: OrderStatus | null;

	@Field(() => OrderPriority, { nullable: true })
	orderPriority: OrderPriority | null;
}
