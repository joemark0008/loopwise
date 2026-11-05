import { IDENTIFICATION_LABELS } from '@loopwise/shared/patient-registration';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

import { toDateOnly } from '../parse-input.js';
import type { PatientRow } from '../patient.repository.js';
import { DuplicateMatch, IdentificationType, Sex } from '../patients.enums.js';

@ObjectType({ description: 'A government or discount ID of the patient (PhilHealth, PhilSys, senior citizen, PWD …).' })
export class PatientIdentification {
	@Field(() => ID)
	id: string;

	@Field(() => IdentificationType)
	type: IdentificationType;

	@Field()
	idNumber: string;

	@Field({ description: 'How the ID is named on screen, e.g. "PhilHealth".' })
	label: string;
}

@ObjectType({ description: "The patient's primary address (PSGC barangay)." })
export class PatientAddress {
	@Field(() => String, { nullable: true, description: 'House no., street, purok / sitio.' })
	addressLine: string | null;

	@Field(() => String, { nullable: true })
	barangayCode: string | null;

	@Field(() => String, { nullable: true })
	barangayName: string | null;

	@Field(() => String, { nullable: true })
	cityMunicipalityName: string | null;
}

@ObjectType({ description: 'A patient the signed-in user may see (row-level security).' })
export class Patient {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	organizationId: string;

	@Field({ description: "The organization's patient (chart) number, e.g. TAG-PT-2026-000001." })
	patientNo: string;

	@Field({ description: 'First name.' })
	givenName: string;

	@Field(() => String, { nullable: true })
	middleName: string | null;

	@Field({ description: 'Last name.' })
	familyName: string;

	@Field(() => String, { nullable: true, description: 'Jr., Sr., III.' })
	suffix: string | null;

	@Field({ description: 'YYYY-MM-DD.' })
	birthDate: string;

	@Field(() => Sex)
	sex: Sex;

	@Field(() => String, { nullable: true, description: 'Mobile number, +639XXXXXXXXX.' })
	phone: string | null;

	@Field(() => String, { nullable: true })
	email: string | null;

	@Field(() => String, { nullable: true, description: '`en`, `fil` or `ceb`.' })
	preferredLanguage: string | null;

	@Field(() => String, { nullable: true, description: 'Barangay of residence (from the primary address).' })
	barangay: string | null;

	@Field(() => PatientAddress, { nullable: true })
	address: PatientAddress | null;

	@Field(() => Date, {
		nullable: true,
		description: 'When the data-privacy consent (RA 10173) was signed; null when none is on file.',
	})
	consentAt: Date | null;

	@Field()
	createdAt: Date;

	@Field(() => [PatientIdentification])
	identifications: PatientIdentification[];
}

@ObjectType({ description: 'An existing patient a registration may duplicate. Masked when the user cannot see them.' })
export class PatientDuplicate {
	@Field(() => ID)
	patientId: string;

	@Field(() => DuplicateMatch)
	match: DuplicateMatch;

	@Field({ description: 'Whether the user can already open this patient.' })
	visible: boolean;

	@Field({ description: 'What matched, e.g. `patient no. TAG-PT-2026-000001` or `name, birth date and sex`.' })
	matchedOn: string;

	@Field({ description: 'The full name when visible, else initials ("M. S.").' })
	displayName: string;

	@Field(() => Int)
	birthYear: number;
}

@ObjectType()
export class RegisterPatientPayload {
	@Field(() => Patient, { nullable: true, description: 'The new patient; null when duplicates stopped it.' })
	patient: Patient | null;

	@Field(() => [PatientDuplicate])
	duplicates: PatientDuplicate[];
}

export function toPatient(row: PatientRow): Patient {
	const [address] = row.addresses;
	const [consent] = row.consents;
	return {
		id: row.id,
		organizationId: row.organizationId,
		patientNo: row.patientNo,
		givenName: row.firstName,
		middleName: row.middleName,
		familyName: row.lastName,
		suffix: row.suffix,
		birthDate: toDateOnly(row.birthDate),
		sex: row.sex,
		phone: row.mobileNo,
		email: row.email,
		preferredLanguage: row.preferredLanguage,
		barangay: address?.barangay?.name ?? null,
		address: address
			? {
					addressLine: address.addressLine,
					barangayCode: address.barangayCode,
					barangayName: address.barangay?.name ?? null,
					cityMunicipalityName: address.cityMunicipality?.name ?? null,
				}
			: null,
		consentAt: consent?.signedAt ?? null,
		createdAt: row.createdAt,
		identifications: row.identifications.map((identification) => ({
			id: identification.id,
			type: identification.type,
			idNumber: identification.idNumber,
			label: IDENTIFICATION_LABELS[identification.type] ?? identification.type,
		})),
	};
}

/** "Maria Santos". */
export const patientName = (row: { firstName: string; lastName: string }): string => `${row.firstName} ${row.lastName}`;
