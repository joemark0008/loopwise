import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

import { VatRegistration } from '../../../../generated/prisma/enums.js';
import type { ClinicProfileRow } from '../clinic-profile.repository.js';

registerEnumType(VatRegistration, { name: 'VatRegistration', description: 'BIR registration: VAT or NON_VAT.' });

export { VatRegistration };

@ObjectType({ description: "The organization's legal details (the clinic group; BIR, SEC / DTI)." })
export class OrganizationProfile {
	@Field(() => ID)
	id: string;

	@Field({ description: 'Registered business name (DTI / SEC).' })
	name: string;

	@Field(() => String, { nullable: true })
	tradeName: string | null;

	@Field(() => String, { nullable: true, description: 'BIR TIN, e.g. 123-456-789-000.' })
	tin: string | null;

	@Field(() => VatRegistration)
	vatRegistration: VatRegistration;

	@Field(() => String, { nullable: true, description: 'SEC or DTI registration number.' })
	secOrDtiNo: string | null;

	@Field(() => String, { nullable: true })
	logoUrl: string | null;
}

@ObjectType({ description: 'A clinic (branch): its code, registrations (BIR, DOH, PhilHealth), address and contact.' })
export class ClinicProfile {
	@Field(() => ID)
	id: string;

	@Field({ description: 'Short code printed in document numbers, e.g. TAG.' })
	code: string;

	@Field()
	name: string;

	@Field(() => String, { nullable: true, description: 'BIR branch code (last digits of the TIN), e.g. 00000.' })
	birBranchCode: string | null;

	@Field(() => String, { nullable: true, description: 'DOH License to Operate number.' })
	dohLicenseNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	dohLicenseExpiry: string | null;

	@Field(() => String, { nullable: true, description: 'PhilHealth facility accreditation number.' })
	philhealthAccreditNo: string | null;

	@Field(() => String, { nullable: true, description: 'YYYY-MM-DD.' })
	philhealthAccreditExp: string | null;

	@Field(() => String, { nullable: true, description: 'Street, building.' })
	addressLine: string | null;

	@Field(() => String, { nullable: true, description: 'PSGC code.' })
	barangayCode: string | null;

	@Field(() => String, { nullable: true })
	barangayName: string | null;

	@Field(() => String, { nullable: true, description: 'PSGC code.' })
	cityMunicipalityCode: string | null;

	@Field(() => String, { nullable: true })
	cityMunicipalityName: string | null;

	@Field(() => String, { nullable: true })
	provinceName: string | null;

	@Field(() => String, { nullable: true })
	zipCode: string | null;

	@Field(() => String, { nullable: true })
	contactNo: string | null;

	@Field(() => String, { nullable: true })
	email: string | null;

	@Field()
	isActive: boolean;
}

@ObjectType({ description: 'Settings → Clinic → Profile: the organization and the selected clinic.' })
export class ClinicSetupProfile {
	@Field(() => OrganizationProfile)
	organization: OrganizationProfile;

	@Field(() => ClinicProfile)
	clinic: ClinicProfile;

	@Field({ description: "The user may change the organization's legal details (its ADMIN, or a SUPER_ADMIN)." })
	canEditOrganization: boolean;
}

const dateOnly = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export function toOrganizationProfile(row: ClinicProfileRow['organization']): OrganizationProfile {
	return {
		id: row.id,
		name: row.name,
		tradeName: row.tradeName,
		tin: row.tin,
		vatRegistration: row.vatRegistration,
		secOrDtiNo: row.secOrDtiNo,
		logoUrl: row.logoUrl,
	};
}

export function toClinicProfile(row: ClinicProfileRow): ClinicProfile {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		birBranchCode: row.birBranchCode,
		dohLicenseNo: row.dohLicenseNo,
		dohLicenseExpiry: dateOnly(row.dohLicenseExpiry),
		philhealthAccreditNo: row.philhealthAccreditNo,
		philhealthAccreditExp: dateOnly(row.philhealthAccreditExp),
		addressLine: row.addressLine,
		barangayCode: row.barangayCode,
		barangayName: row.barangay?.name ?? null,
		cityMunicipalityCode: row.cityMunicipalityCode,
		cityMunicipalityName: row.cityMunicipality?.name ?? null,
		provinceName: row.cityMunicipality?.province?.name ?? null,
		zipCode: row.zipCode,
		contactNo: row.contactNo,
		email: row.email,
		isActive: row.isActive,
	};
}
