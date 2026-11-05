import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

import type {
	EncounterDiagnosis as DiagnosisRow,
	Prisma,
	VitalSigns as VitalSignsRow,
} from '../../../generated/prisma/client.js';
import { PatientAllergy } from '../../patients/models/patient-allergy.model.js';
import { DiagnosisType } from '../encounters.enums.js';
import { Encounter } from './encounter.model.js';

@ObjectType({ description: 'One set of vital signs. Units: mmHg, bpm, /min, °C, %, kg, cm, mg/dL.' })
export class VitalSigns {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => Int, { nullable: true })
	systolicMmHg: number | null;

	@Field(() => Int, { nullable: true })
	diastolicMmHg: number | null;

	@Field(() => Int, { nullable: true })
	heartRateBpm: number | null;

	@Field(() => Int, { nullable: true })
	respiratoryRate: number | null;

	@Field(() => Float, { nullable: true })
	temperatureC: number | null;

	@Field(() => Int, { nullable: true })
	spo2Pct: number | null;

	@Field(() => Float, { nullable: true })
	weightKg: number | null;

	@Field(() => Float, { nullable: true })
	heightCm: number | null;

	@Field(() => Float, { nullable: true, description: 'Computed from weight and height.' })
	bmi: number | null;

	@Field(() => Float, { nullable: true, description: 'Capillary blood glucose (CBG), mg/dL.' })
	bloodGlucoseMgDl: number | null;

	@Field(() => Int, { nullable: true })
	painScore: number | null;

	@Field()
	recordedAt: Date;

	@Field(() => ID, { nullable: true })
	recordedById: string | null;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;
}

@ObjectType({ description: 'A diagnosis of the encounter, ICD-10 coded (PhilHealth).' })
export class EncounterDiagnosis {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => String, { nullable: true, description: 'ICD-10 code of `icd10_codes`.' })
	icd10Code: string | null;

	@Field({ description: 'As printed on the Rx and certificate, normally the ICD-10 title.' })
	description: string;

	@Field(() => DiagnosisType, { description: 'One PRIMARY per encounter.' })
	type: DiagnosisType;

	@Field({ description: 'False while it is still an impression being worked up.' })
	isFinal: boolean;

	@Field(() => Int)
	sortOrder: number;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field()
	recordedAt: Date;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;
}

@ObjectType({
	description:
		'An encounter and what was recorded in it, read as the user (row-level security). Prescriptions, certificates, ' +
		'referrals, orders and invoices are fields their own modules add.',
})
export class EncounterRecord {
	@Field(() => Encounter)
	encounter: Encounter;

	@Field(() => [VitalSigns], { description: 'Newest first, voided included.' })
	vitals: VitalSigns[];

	@Field(() => [EncounterDiagnosis], { description: 'Primary first, then by sort order; voided included.' })
	diagnoses: EncounterDiagnosis[];

	@Field(() => [PatientAllergy], { description: "The patient's active allergies." })
	allergies: PatientAllergy[];

	@Field({ description: 'The user works at the clinic of the visit, so may add to its record.' })
	canEdit: boolean;
}

@ObjectType({
	description: 'One visit as the chart lists it: the encounter and its diagnoses (more fields per module).',
})
export class PatientVisit {
	@Field(() => Encounter)
	encounter: Encounter;

	@Field(() => [EncounterDiagnosis], { description: 'Not voided, primary first.' })
	diagnoses: EncounterDiagnosis[];
}

@ObjectType({ description: "The patient chart's overview, read as the user (row-level security): the recent visits." })
export class PatientOverview {
	@Field(() => ID)
	patientId: string;

	@Field(() => [PatientVisit], { description: 'Newest first (the latest 20).' })
	visits: PatientVisit[];
}

const decimal = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

export function toVitalSigns(row: VitalSignsRow): VitalSigns {
	return {
		id: row.id,
		encounterId: row.encounterId,
		systolicMmHg: row.systolicBp,
		diastolicMmHg: row.diastolicBp,
		heartRateBpm: row.heartRate,
		respiratoryRate: row.respiratoryRate,
		temperatureC: decimal(row.temperatureC),
		spo2Pct: row.oxygenSaturation,
		weightKg: decimal(row.weightKg),
		heightCm: decimal(row.heightCm),
		bmi: decimal(row.bmi),
		bloodGlucoseMgDl: decimal(row.bloodGlucose),
		painScore: row.painScore,
		recordedAt: row.recordedAt,
		recordedById: row.recordedById,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
	};
}

export function toDiagnosis(row: DiagnosisRow): EncounterDiagnosis {
	return {
		id: row.id,
		encounterId: row.encounterId,
		icd10Code: row.icd10Code,
		description: row.description,
		type: row.type,
		isFinal: row.isFinal,
		sortOrder: row.sortOrder,
		notes: row.notes,
		recordedAt: row.recordedAt,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
	};
}
