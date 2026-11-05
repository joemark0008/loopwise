import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import type { MedicalCertificate as MedicalCertificateRow } from '../../../generated/prisma/client.js';
import { DocumentStatus, WorkFitness } from '../../../generated/prisma/enums.js';
import { DocumentSignatory } from '../../prescriptions/models/prescription.model.js';

registerEnumType(WorkFitness, { name: 'WorkFitness' });

@ObjectType({ description: 'A medical certificate issued from an encounter (DESIGN.md §5).' })
export class MedicalCertificate {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => DocumentStatus)
	status: DocumentStatus;

	@Field(() => Int, { description: 'Moves on every change; pass it back as `expectedVersion`.' })
	version: number;

	@Field(() => String, { nullable: true })
	certificateNumber: string | null;

	@Field({ description: 'YYYY-MM-DD.' })
	examinedOn: string;

	@Field()
	diagnosisText: string;

	@Field(() => WorkFitness)
	fitness: WorkFitness;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	restFrom: string | null;

	@Field(() => Int, { nullable: true })
	restDays: number | null;

	@Field(() => String, { nullable: true })
	remarks: string | null;

	@Field(() => String, { nullable: true })
	purpose: string | null;

	@Field(() => Date, { nullable: true })
	issuedAt: Date | null;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;

	@Field()
	createdAt: Date;

	@Field(() => ID)
	issuedById: string;

	/** Filled for the print view (`medicalCertificate(id)`); null in the encounter record. */
	@Field(() => DocumentSignatory, { nullable: true })
	signatory: DocumentSignatory | null;
}

const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export function toMedicalCertificate(
	row: MedicalCertificateRow,
	signatory: DocumentSignatory | null = null,
): MedicalCertificate {
	return {
		id: row.id,
		encounterId: row.encounterId,
		patientId: row.patientId,
		status: row.status,
		version: row.version,
		certificateNumber: row.certificateNumber,
		examinedOn: dateOnly(row.examinedOn) ?? '',
		diagnosisText: row.diagnosisText,
		fitness: row.fitness,
		restFrom: dateOnly(row.restFrom),
		restDays: row.restDays,
		remarks: row.remarks,
		purpose: row.purpose,
		issuedAt: row.issuedAt,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
		createdAt: row.createdAt,
		issuedById: row.issuedById,
		signatory,
	};
}
