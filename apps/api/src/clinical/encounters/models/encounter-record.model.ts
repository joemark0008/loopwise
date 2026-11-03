import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type {
	EncounterDiagnosis as DiagnosisRow,
	PatientAllergy as AllergyRow,
	Prisma,
	VitalSigns as VitalSignsRow,
} from '../../../generated/prisma/client.js';
import { AllergyKind, AllergySeverity, DiagnosisCertainty } from '../../../generated/prisma/enums.js';
import { EncounterBill } from '../../billing/models/encounter-bill.model.js';
import { MedicalCertificate } from '../../medical-certificates/models/medical-certificate.model.js';
import { ClinicalOrder } from '../../orders/models/order.model.js';
import { Prescription } from '../../prescriptions/models/prescription.model.js';
import { Encounter } from './encounter.model.js';

registerEnumType(DiagnosisCertainty, { name: 'DiagnosisCertainty' });
registerEnumType(AllergyKind, { name: 'AllergyKind' });
registerEnumType(AllergySeverity, { name: 'AllergySeverity' });

@ObjectType({ description: 'One set of vital signs. Units: mmHg, bpm, /min, °C, %, kg, cm, mg/dL.' })
export class VitalSigns {
	@Field(() => ID)
	id: string;

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

	@Field(() => Int, { nullable: true })
	bloodGlucoseMgDl: number | null;

	@Field(() => Int, { nullable: true })
	painScore: number | null;

	@Field()
	recordedAt: Date;

	@Field(() => ID)
	recordedById: string;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;
}

@ObjectType({ description: 'An ICD-10 coded diagnosis of the encounter.' })
export class EncounterDiagnosis {
	@Field(() => ID)
	id: string;

	@Field()
	icd10Code: string;

	@Field()
	display: string;

	@Field(() => DiagnosisCertainty)
	certainty: DiagnosisCertainty;

	@Field()
	isPrimary: boolean;

	@Field(() => String, { nullable: true })
	notes: string | null;

	@Field()
	createdAt: Date;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;
}

@ObjectType({ description: 'A known allergy of the patient.' })
export class PatientAllergy {
	@Field(() => ID)
	id: string;

	@Field()
	substance: string;

	@Field(() => AllergyKind)
	kind: AllergyKind;

	@Field(() => String, { nullable: true })
	reaction: string | null;

	@Field(() => AllergySeverity, { nullable: true })
	severity: AllergySeverity | null;

	@Field()
	createdAt: Date;
}

@ObjectType({ description: 'An ICD-10 code and its WHO title.' })
export class Icd10Code {
	@Field()
	code: string;

	@Field()
	title: string;
}

@ObjectType({ description: 'An encounter and everything recorded in it, read as the user (row-level security).' })
export class EncounterRecord {
	@Field(() => Encounter)
	encounter: Encounter;

	@Field(() => [VitalSigns], { description: 'Newest first, voided included.' })
	vitals: VitalSigns[];

	@Field(() => [EncounterDiagnosis], { description: 'Primary first, voided included.' })
	diagnoses: EncounterDiagnosis[];

	@Field(() => [PatientAllergy], { description: "The patient's allergies (not voided)." })
	allergies: PatientAllergy[];

	@Field(() => [ClinicalOrder])
	orders: ClinicalOrder[];

	@Field(() => [Prescription], { description: 'Newest first.' })
	prescriptions: Prescription[];

	@Field(() => [MedicalCertificate], { description: 'Newest first.' })
	medicalCertificates: MedicalCertificate[];

	@Field(() => [EncounterBill], { description: 'Newest first: at most one is not voided.' })
	bills: EncounterBill[];

	@Field({ description: 'The user works at the encounter’s facility, so may add to its record.' })
	canEdit: boolean;
}

const decimal = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

export function toVitalSigns(row: VitalSignsRow): VitalSigns {
	return {
		id: row.id,
		systolicMmHg: row.systolicMmHg,
		diastolicMmHg: row.diastolicMmHg,
		heartRateBpm: row.heartRateBpm,
		respiratoryRate: row.respiratoryRate,
		temperatureC: decimal(row.temperatureC),
		spo2Pct: row.spo2Pct,
		weightKg: decimal(row.weightKg),
		heightCm: decimal(row.heightCm),
		bmi: decimal(row.bmi),
		bloodGlucoseMgDl: row.bloodGlucoseMgDl,
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
		icd10Code: row.icd10Code,
		display: row.display,
		certainty: row.certainty,
		isPrimary: row.isPrimary,
		notes: row.notes,
		createdAt: row.createdAt,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
	};
}

export function toAllergy(row: AllergyRow): PatientAllergy {
	return {
		id: row.id,
		substance: row.substance,
		kind: row.kind,
		reaction: row.reaction,
		severity: row.severity,
		createdAt: row.createdAt,
	};
}
