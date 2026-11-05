import type { StaffRole } from '@loopwise/shared/staff-roles';
import { Injectable } from '@nestjs/common';

import { AccessService } from '../../common/guards/access.service.js';
import { LabDeskAccessDeniedError } from './diagnostics.errors.js';

/** The clinic roles that work the lab desk: medical technologists and radiologic technologists. */
export const LAB_DESK_ROLES = ['MEDTECH', 'RADTECH'] as const satisfies readonly StaffRole[];

/**
 * Who works a clinic's lab desk (the worklist, collecting, entering and releasing results, refusing a test): its
 * MEDTECH / RADTECH staff and its admins (`@ClinicAccess({ staffRoles })` lets admins through the same way).
 * Row-level security still decides which patients they see (`app_can_see_patient`: lab roles see the patients with a
 * diagnostic order at their clinic).
 */
@Injectable()
export class LabDeskAccess {
	constructor(private readonly access: AccessService) {}

	/** The clinics where the user works the lab desk. */
	async clinicIds(userId: string): Promise<string[]> {
		return (await this.access.listUserClinics(userId))
			.filter(
				(grant) =>
					grant.userRole === 'admin' ||
					grant.staffRoles.some((role) => (LAB_DESK_ROLES as readonly string[]).includes(role)),
			)
			.map((grant) => grant.clinic.id);
	}

	async isLabDesk(userId: string, clinicId: string): Promise<boolean> {
		return (await this.clinicIds(userId)).includes(clinicId);
	}

	async assert(userId: string, clinicId: string): Promise<void> {
		if (!(await this.isLabDesk(userId, clinicId))) {
			throw new LabDeskAccessDeniedError();
		}
	}
}
