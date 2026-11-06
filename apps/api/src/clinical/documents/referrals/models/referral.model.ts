import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../../generated/prisma/client.js';
import { DocumentSignatory } from '../../../practitioners/models/document-signatory.model.js';
import { OrderPriority, ReferralStatus } from '../../documents.enums.js';

@ObjectType({
	description:
		'A referral from an encounter: to a practitioner of the organization, or an outside doctor / facility.',
})
export class Referral {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field(() => ID)
	patientId: string;

	@Field({ description: "The referring visit's number." })
	encounterNo: string;

	@Field(() => ID, { description: 'The clinic of the referring visit.' })
	clinicId: string;

	@Field({ description: 'The patient, as the referral lists show them.' })
	patientName: string;

	@Field()
	patientNo: string;

	@Field({
		description:
			'To a practitioner of the organization (answered by them); else outside (marked by the referring side).',
	})
	isInternal: boolean;

	@Field(() => ID, { description: 'The referring practitioner.' })
	fromPractitionerId: string;

	@Field(() => ID, { nullable: true, description: 'Internal referral: the practitioner referred to.' })
	toPractitionerId: string | null;

	@Field(() => String, { nullable: true })
	toExternalDoctor: string | null;

	@Field(() => String, { nullable: true })
	toFacility: string | null;

	@Field(() => String, { nullable: true })
	specialty: string | null;

	@Field()
	reason: string;

	@Field(() => String, { nullable: true })
	clinicalSummary: string | null;

	@Field(() => OrderPriority)
	urgency: OrderPriority;

	@Field(() => ReferralStatus)
	status: ReferralStatus;

	@Field()
	referredAt: Date;

	@Field(() => String, { nullable: true })
	responseNotes: string | null;

	@Field(() => Date, { nullable: true })
	respondedAt: Date | null;
}

@ObjectType({ description: 'A referral as printed: the referral and the referring doctor on the clinic letterhead.' })
export class ReferralLetter {
	@Field(() => Referral)
	referral: Referral;

	@Field(() => DocumentSignatory, { description: "The referring doctor (PRC, PTR) and the clinic's letterhead." })
	signatory: DocumentSignatory;
}

export const REFERRAL_INCLUDE = {
	encounter: {
		select: {
			patientId: true,
			encounterNo: true,
			clinicId: true,
			patient: { select: { firstName: true, middleName: true, lastName: true, patientNo: true } },
		},
	},
} satisfies Prisma.ReferralInclude;

export type ReferralRow = Prisma.ReferralGetPayload<{ include: typeof REFERRAL_INCLUDE }>;

export function toReferral(row: ReferralRow): Referral {
	return {
		id: row.id,
		encounterId: row.encounterId,
		patientId: row.encounter.patientId,
		encounterNo: row.encounter.encounterNo,
		clinicId: row.encounter.clinicId,
		patientName: [row.encounter.patient.firstName, row.encounter.patient.middleName, row.encounter.patient.lastName]
			.filter(Boolean)
			.join(' '),
		patientNo: row.encounter.patient.patientNo,
		isInternal: row.toPractitionerId !== null,
		fromPractitionerId: row.fromPractitionerId,
		toPractitionerId: row.toPractitionerId,
		toExternalDoctor: row.toExternalDoctor,
		toFacility: row.toFacility,
		specialty: row.specialty,
		reason: row.reason,
		clinicalSummary: row.clinicalSummary,
		urgency: row.urgency,
		status: row.status,
		referredAt: row.referredAt,
		responseNotes: row.responseNotes,
		respondedAt: row.respondedAt,
	};
}
