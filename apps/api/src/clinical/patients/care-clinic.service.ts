import { Injectable } from '@nestjs/common';

import { AccessService, type ClinicAccessGrant } from '../../common/guards/access.service.js';
import type { ClinicRef } from './models/clinic-ref.model.js';
import { ClinicNotAvailableError, PatientOutsideOrganizationError } from './patients.errors.js';

/**
 * The clinics where the user does clinical work: any clinic they hold a role at (or whose organization they belong
 * to), except as a viewer. Patients are registered, visits recorded and records changed only at one of them; row-level
 * security checks the same on every write (`app_clinic_ids()`).
 */
@Injectable()
export class CareClinicService {
	constructor(private readonly access: AccessService) {}

	/** The user's care clinics, by name. */
	async list(userId: string): Promise<ClinicRef[]> {
		return (await this.grants(userId)).map(({ clinic }) => toClinicRef(clinic));
	}

	/** The clinic, when the user works there; CLINIC_NOT_AVAILABLE otherwise (`action` names what they tried). */
	async require(userId: string, clinicId: string, action: string): Promise<ClinicRef> {
		const grant = (await this.grants(userId)).find(({ clinic }) => clinic.id === clinicId);
		if (!grant) {
			throw new ClinicNotAvailableError(action);
		}
		return toClinicRef(grant.clinic);
	}

	/** Whether the user works at the clinic. */
	async worksAt(userId: string, clinicId: string): Promise<boolean> {
		return (await this.grants(userId)).some(({ clinic }) => clinic.id === clinicId);
	}

	/**
	 * A clinic of the organization where the user works (the first by name), for a change to an organization-level
	 * record (a patient's contact details, allergies); PATIENT_OUTSIDE_ORGANIZATION otherwise.
	 */
	async requireInOrganization(userId: string, organizationId: string): Promise<ClinicRef> {
		const grant = (await this.grants(userId)).find(({ clinic }) => clinic.organizationId === organizationId);
		if (!grant) {
			throw new PatientOutsideOrganizationError();
		}
		return toClinicRef(grant.clinic);
	}

	private async grants(userId: string): Promise<ClinicAccessGrant[]> {
		return (await this.access.listUserClinics(userId)).filter(({ userRole }) => userRole !== 'viewer');
	}
}

export function toClinicRef(clinic: ClinicAccessGrant['clinic']): ClinicRef {
	return {
		id: clinic.id,
		name: clinic.name,
		code: clinic.code,
		organizationId: clinic.organizationId,
		cityMunicipalityCode: clinic.cityMunicipalityCode,
	};
}
