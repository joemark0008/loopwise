import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { PatientConsent } from '../../../generated/prisma/client.js';

@ObjectType({
	description:
		"The patient's answer to recording a visit for the AI scribe: a `patient_consents` row of type PHOTO_VIDEO tied to the encounter. The latest answer counts.",
})
export class RecordingConsent {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	encounterId: string;

	@Field({ description: 'The consent type of the base schema used for recording (PHOTO_VIDEO).' })
	type: string;

	@Field({ description: 'The version of the consent text read to the patient.' })
	version: string;

	@Field({ description: 'Whether the patient agreed; false records a refusal or a withdrawal.' })
	granted: boolean;

	@Field(() => String, { nullable: true, description: 'Who answered: the patient, or a guardian for a minor.' })
	signedBy: string | null;

	@Field()
	signedAt: Date;

	@Field(() => Date, { nullable: true })
	revokedAt: Date | null;

	@Field({ description: 'Granted and not revoked: recording is allowed.' })
	isActive: boolean;
}

export function toRecordingConsent(row: PatientConsent): RecordingConsent {
	return {
		id: row.id,
		encounterId: row.encounterId!,
		type: row.type,
		version: row.version,
		granted: row.granted,
		signedBy: row.signedBy,
		signedAt: row.signedAt,
		revokedAt: row.revokedAt,
		isActive: row.granted && !row.revokedAt,
	};
}
