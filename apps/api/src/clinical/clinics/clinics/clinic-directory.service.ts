import type { CustomBoundarySet } from '@loopwise/shared';
import type { DisplaySettings } from '@loopwise/shared/date';
import { Injectable } from '@nestjs/common';

import type { Clinic, Prisma, StaffRole } from '../../../generated/prisma/client.js';
import { ClinicRepository, type ClinicUser, type NewClinic } from './clinic.repository.js';

/**
 * Clinic lookups and the clinic's Wise workspace settings, for the platform modules (agent, chats, charts, skills,
 * attachments, organizations). They use this service, never `ClinicRepository`.
 */
@Injectable()
export class ClinicDirectoryService {
	constructor(private readonly clinics: ClinicRepository) {}

	getClinicById(clinicId: string): Promise<Clinic | null> {
		return this.clinics.getClinicById(clinicId);
	}

	getClinicByPath(path: string, tx?: Prisma.TransactionClient): Promise<Clinic | null> {
		return this.clinics.getClinicByPath(path, tx);
	}

	/** Creates a clinic with its default user group; on the caller's transaction when given. */
	createClinic(clinic: NewClinic, tx?: Prisma.TransactionClient): Promise<Clinic> {
		return this.clinics.createClinic(clinic, tx);
	}

	/** Adds the roles the user doesn't hold yet at the clinic. */
	grantClinicRoles(
		clinicId: string,
		userId: string,
		roles: readonly StaffRole[],
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		return this.clinics.grantClinicRoles(clinicId, userId, roles, tx);
	}

	/** Users with a role at the clinic or a membership of its organization, with their access level there. */
	listUsersWithClinicAccess(clinicId: string): Promise<ClinicUser[]> {
		return this.clinics.listUsersWithClinicAccess(clinicId);
	}

	getDisplaySettings(clinicId: string): Promise<DisplaySettings> {
		return this.clinics.getDisplaySettings(clinicId);
	}

	getCustomBoundaries(clinicId: string): Promise<CustomBoundarySet[]> {
		return this.clinics.getCustomBoundaries(clinicId);
	}

	addCustomBoundary(clinicId: string, boundary: CustomBoundarySet): Promise<CustomBoundarySet[]> {
		return this.clinics.addCustomBoundary(clinicId, boundary);
	}

	updateCustomBoundary(
		clinicId: string,
		key: string,
		patch: Partial<CustomBoundarySet>,
	): Promise<CustomBoundarySet[]> {
		return this.clinics.updateCustomBoundary(clinicId, key, patch);
	}

	deleteCustomBoundary(clinicId: string, key: string): Promise<CustomBoundarySet[]> {
		return this.clinics.deleteCustomBoundary(clinicId, key);
	}
}

export type { ClinicUser };
