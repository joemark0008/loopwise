import { Field, ID, ObjectType } from '@nestjs/graphql';

import type { Practitioner as PractitionerRow } from '../../../generated/prisma/client.js';
import { PractitionerType } from '../practitioners.enums.js';

@ObjectType({ description: 'A clinic where the practitioner holds clinic.' })
export class PractitionerClinic {
	@Field(() => ID)
	clinicId: string;

	@Field()
	clinicName: string;

	@Field(() => String, { nullable: true })
	roomName: string | null;
}

@ObjectType({
	description:
		'A doctor, dentist, midwife …: what prescriptions, certificates and referrals print about who signs them.',
})
export class Practitioner {
	@Field(() => ID)
	id: string;

	@Field(() => ID, { nullable: true, description: 'The Loopwise user, when the practitioner signs in.' })
	userId: string | null;

	@Field(() => PractitionerType)
	type: PractitionerType;

	@Field(() => String, { nullable: true, description: '"Dr.", "Dra."' })
	title: string | null;

	@Field()
	firstName: string;

	@Field(() => String, { nullable: true })
	middleName: string | null;

	@Field()
	lastName: string;

	@Field(() => String, { nullable: true })
	suffix: string | null;

	@Field(() => String, { nullable: true, description: '"MD, FPCP".' })
	postNominals: string | null;

	@Field({ description: 'As printed: "Dra. Ana Reyes, MD".' })
	displayName: string;

	@Field(() => String, { nullable: true })
	specialty: string | null;

	@Field(() => String, { nullable: true })
	subspecialty: string | null;

	@Field({ description: 'PRC license number.' })
	prcLicenseNo: string;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	prcLicenseExpiry: string | null;

	@Field(() => String, { nullable: true, description: 'Professional tax receipt number (renewed yearly).' })
	ptrNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	ptrIssuedDate: string | null;

	@Field(() => String, { nullable: true, description: 'The LGU that issued the PTR.' })
	ptrIssuedAt: string | null;

	@Field(() => String, { nullable: true, description: 'PDEA S2 license, needed to prescribe dangerous drugs.' })
	s2LicenseNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	s2LicenseExpiry: string | null;

	@Field(() => String, { nullable: true, description: 'PhilHealth accreditation number (PAN).' })
	philhealthPan: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	philhealthPanExpiry: string | null;

	@Field(() => String, { nullable: true })
	mobileNo: string | null;

	@Field(() => String, { nullable: true })
	email: string | null;

	@Field(() => [PractitionerClinic])
	clinics: PractitionerClinic[];
}

/** "Dra. Ana Reyes, MD": how documents print the practitioner. */
export function practitionerDisplayName(
	row: Pick<PractitionerRow, 'title' | 'firstName' | 'middleName' | 'lastName' | 'suffix' | 'postNominals'>,
): string {
	const middleInitial = row.middleName?.trim() ? `${row.middleName.trim().charAt(0).toUpperCase()}.` : null;
	const name = [row.title, row.firstName, middleInitial, row.lastName, row.suffix].filter(Boolean).join(' ');
	return row.postNominals ? `${name}, ${row.postNominals}` : name;
}

const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export function toPractitioner(
	row: PractitionerRow & { clinics?: { clinicId: string; roomName: string | null; clinic: { name: string } }[] },
): Practitioner {
	return {
		id: row.id,
		userId: row.userId,
		type: row.type,
		title: row.title,
		firstName: row.firstName,
		middleName: row.middleName,
		lastName: row.lastName,
		suffix: row.suffix,
		postNominals: row.postNominals,
		displayName: practitionerDisplayName(row),
		specialty: row.specialty,
		subspecialty: row.subspecialty,
		prcLicenseNo: row.prcLicenseNo,
		prcLicenseExpiry: dateOnly(row.prcLicenseExpiry),
		ptrNo: row.ptrNo,
		ptrIssuedDate: dateOnly(row.ptrIssuedDate),
		ptrIssuedAt: row.ptrIssuedAt,
		s2LicenseNo: row.s2LicenseNo,
		s2LicenseExpiry: dateOnly(row.s2LicenseExpiry),
		philhealthPan: row.philhealthPan,
		philhealthPanExpiry: dateOnly(row.philhealthPanExpiry),
		mobileNo: row.mobileNo,
		email: row.email,
		clinics: (row.clinics ?? []).map((link) => ({
			clinicId: link.clinicId,
			clinicName: link.clinic.name,
			roomName: link.roomName,
		})),
	};
}
