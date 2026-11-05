import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { Prisma } from '../../../generated/prisma/client.js';

/**
 * Who signs a prescription, medical certificate or referral, as printed: the practitioner's name and credentials (PRC
 * license, PTR, S2 for dangerous drugs) and the clinic's letterhead. Frozen into the document's `signatory` column when
 * it is issued; a draft shows today's values.
 */
@ObjectType({
	description: "The practitioner and clinic printed on a document: the issue-time snapshot, or today's for a draft.",
})
export class DocumentSignatory {
	@Field(() => ID, { nullable: true })
	practitionerId: string | null;

	@Field()
	name: string;

	@Field(() => String, { nullable: true, description: 'Post-nominals, e.g. "MD".' })
	credentials: string | null;

	@Field(() => String, { nullable: true })
	specialty: string | null;

	@Field(() => String, { nullable: true, description: 'PRC license number.' })
	licenseNumber: string | null;

	@Field(() => String, { nullable: true, description: 'PTR number.' })
	ptrNumber: string | null;

	@Field(() => String, { nullable: true, description: 'PDEA S2 license number.' })
	s2LicenseNo: string | null;

	@Field()
	facilityName: string;

	@Field(() => String, { nullable: true })
	facilityAddress: string | null;

	@Field(() => String, { nullable: true })
	facilityPhone: string | null;
}

/** The JSON stored in `signatory` (the same fields). */
export function signatoryJson(signatory: DocumentSignatory): Prisma.InputJsonObject {
	return { ...signatory };
}

/** Reads a stored `signatory` back; null when it is missing or malformed. */
export function parseSignatory(value: Prisma.JsonValue | null): DocumentSignatory | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}
	const record = value as Record<string, unknown>;
	const text = (key: string) => (typeof record[key] === 'string' ? (record[key] as string) : null);
	const name = text('name');
	const facilityName = text('facilityName');
	if (!name || !facilityName) {
		return null;
	}
	return {
		practitionerId: text('practitionerId'),
		name,
		credentials: text('credentials'),
		specialty: text('specialty'),
		licenseNumber: text('licenseNumber'),
		ptrNumber: text('ptrNumber'),
		s2LicenseNo: text('s2LicenseNo'),
		facilityName,
		facilityAddress: text('facilityAddress'),
		facilityPhone: text('facilityPhone'),
	};
}
