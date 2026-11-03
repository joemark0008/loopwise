import { Field, ObjectType } from '@nestjs/graphql';

import { BillStatus } from '../../../generated/prisma/enums.js';
import { ClinicalOrder } from '../../orders/models/order.model.js';
import { Prescription } from '../../prescriptions/models/prescription.model.js';
import { Encounter } from './encounter.model.js';
import { EncounterDiagnosis, VitalSigns } from './encounter-record.model.js';

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
	description: "The patient chart's overview, read as the user (row-level security): recent visits and summaries.",
})
export class PatientOverview {
	@Field(() => [PatientVisit], { description: 'Newest first (the latest 20).' })
	visits: PatientVisit[];

	@Field(() => [VitalSigns], { description: 'The latest sets across visits, newest first (up to 6), for trends.' })
	recentVitals: VitalSigns[];

	@Field(() => [EncounterDiagnosis], { description: 'Recent diagnoses, one per ICD-10 code, newest first.' })
	problems: EncounterDiagnosis[];

	@Field(() => [Prescription], { description: 'The latest prescriptions that are not voided (up to 3).' })
	medicines: Prescription[];

	@Field(() => [ClinicalOrder], { description: 'Orders with results, newest first (up to 6).' })
	results: ClinicalOrder[];
}
