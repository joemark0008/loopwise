import { Field, ObjectType } from '@nestjs/graphql';

import { BillStatus } from '../../../generated/prisma/enums.js';
import { ClinicalOrder } from '../../orders/models/order.model.js';
import { Prescription } from '../../prescriptions/models/prescription.model.js';
import { Encounter } from './encounter.model.js';
import { EncounterDiagnosis } from './encounter-record.model.js';

@ObjectType({ description: 'One visit as the chart lists it: the encounter and what came of it.' })
export class PatientVisit {
	@Field(() => Encounter)
	encounter: Encounter;

	@Field(() => [EncounterDiagnosis], { description: 'Not voided, primary first.' })
	diagnoses: EncounterDiagnosis[];

	@Field(() => [Prescription], { description: 'Not voided, newest first.' })
	prescriptions: Prescription[];

	@Field(() => [ClinicalOrder])
	orders: ClinicalOrder[];

	@Field(() => BillStatus, { nullable: true, description: 'The bill that is not voided, if any.' })
	billStatus: BillStatus | null;
}

@ObjectType({
	description: "The patient chart's overview, read as the user (row-level security): the recent visits.",
})
export class PatientOverview {
	@Field(() => [PatientVisit], { description: 'Newest first (the latest 20).' })
	visits: PatientVisit[];
}
