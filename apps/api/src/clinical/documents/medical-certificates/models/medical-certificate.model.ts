import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { DocumentSignatory } from '../../../practitioners/models/document-signatory.model.js';
import { CertificateType, DocumentStatus } from '../../documents.enums.js';

@ObjectType({ description: 'A medical certificate issued from an encounter (DESIGN.md §5).' })
export class MedicalCertificate {
	@Field(() => ID)
	id: string;

	@Field({ description: "The clinic's certificate number, e.g. TAG-MC-2026-000042 (assigned with the draft)." })
	certNo: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	patientId: string;

	@Field(() => ID, { description: 'The signing practitioner.' })
	practitionerId: string;

	@Field(() => CertificateType)
	type: CertificateType;

	@Field(() => DocumentStatus)
	documentStatus: DocumentStatus;

	@Field(() => Int, { description: 'Moves on every change; pass it back as `expectedVersion`.' })
	version: number;

	@Field({ description: 'YYYY-MM-DD.' })
	examinedOn: string;

	@Field(() => String, { nullable: true })
	diagnosisText: string | null;

	@Field(() => String, { nullable: true })
	findings: string | null;

	@Field(() => String, { nullable: true })
	recommendation: string | null;

	@Field(() => Boolean, { nullable: true })
	isFitToWork: boolean | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	restFrom: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD, the last day of rest.' })
	restTo: string | null;

	@Field(() => Int, { nullable: true })
	restDays: number | null;

	@Field(() => String, { nullable: true })
	purpose: string | null;

	@Field(() => String, { nullable: true, description: 'PEME / APE: Class A, B, C or Pending.' })
	peClassification: string | null;

	@Field({ description: 'Printed (and as a QR) to deter fake certificates.' })
	verificationCode: string;

	@Field(() => Date, { nullable: true, description: 'Null while a draft.' })
	issuedAt: Date | null;

	@Field()
	isVoid: boolean;

	@Field(() => Date, { nullable: true })
	voidedAt: Date | null;

	@Field(() => String, { nullable: true })
	voidReason: string | null;

	@Field()
	createdAt: Date;

	/** The issue-time snapshot, or today's values for a draft; filled for the print view. */
	@Field(() => DocumentSignatory, { nullable: true })
	signatory: DocumentSignatory | null;
}

export const CERTIFICATE_INCLUDE = {
	encounter: { select: { patientId: true, clinicId: true } },
} satisfies Prisma.MedicalCertificateInclude;

export type MedicalCertificateRow = Prisma.MedicalCertificateGetPayload<{ include: typeof CERTIFICATE_INCLUDE }>;

const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export function toMedicalCertificate(
	row: MedicalCertificateRow,
	signatory: DocumentSignatory | null = null,
): MedicalCertificate {
	return {
		id: row.id,
		certNo: row.certNo,
		encounterId: row.encounterId,
		patientId: row.encounter.patientId,
		practitionerId: row.practitionerId,
		type: row.type,
		documentStatus: row.documentStatus,
		version: row.version,
		examinedOn: row.examinedAt.toISOString().slice(0, 10),
		diagnosisText: row.diagnosisText,
		findings: row.findings,
		recommendation: row.recommendation,
		isFitToWork: row.isFitToWork,
		restFrom: dateOnly(row.restFrom),
		restTo: dateOnly(row.restTo),
		restDays: row.restDays,
		purpose: row.purpose,
		peClassification: row.peClassification,
		verificationCode: row.verificationCode,
		issuedAt: row.documentStatus === 'ISSUED' ? row.issuedAt : null,
		isVoid: row.isVoid,
		voidedAt: row.voidedAt,
		voidReason: row.voidReason,
		createdAt: row.createdAt,
		signatory,
	};
}
