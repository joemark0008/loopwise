import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { CREDENTIAL_KINDS, CREDENTIAL_LABELS, type CredentialKind } from '../credential-expiry.js';

const CredentialKindEnum = Object.fromEntries(CREDENTIAL_KINDS.map((kind) => [kind, kind])) as {
	[K in CredentialKind]: K;
};

registerEnumType(CredentialKindEnum, {
	name: 'CredentialKind',
	description:
		'PRC license, S2 license, PhilHealth PAN (practitioners); DOH License to Operate, PhilHealth accreditation (clinics).',
});

@ObjectType({ description: 'A license or accreditation that expires soon (or has expired).' })
export class ExpiringCredential {
	@Field(() => CredentialKindEnum)
	kind: CredentialKind;

	@Field({ description: 'e.g. "PRC license".' })
	label: string;

	@Field({ description: 'PRACTITIONER or CLINIC.' })
	subjectType: string;

	@Field(() => ID)
	subjectId: string;

	@Field()
	subjectName: string;

	@Field(() => String, { nullable: true })
	number: string | null;

	@Field({ description: 'YYYY-MM-DD.' })
	expiresOn: string;

	@Field(() => Int, { description: 'Days left (negative once expired).' })
	daysLeft: number;
}

export function credentialLabel(kind: CredentialKind): string {
	return CREDENTIAL_LABELS[kind];
}
