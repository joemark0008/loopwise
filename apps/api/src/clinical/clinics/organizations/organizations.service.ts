import { Injectable } from '@nestjs/common';

import { AccessService, type ClinicAccessGrant } from '../../../common/guards/access.service.js';
import { ConfigService } from '../../../config/config.service.js';
import type { Organization, Prisma } from '../../../generated/prisma/client.js';
import { ClinicDirectoryService } from '../clinics/clinic-directory.service.js';
import { type GoogleConfig, OrganizationRepository } from './organization.repository.js';

/** An organization the user works in, and whether they may administer it. */
export interface UserOrganization {
	organization: Organization;
	/** The user's `organization_members` role is ADMIN, or they are an admin at one of its clinics. */
	isAdmin: boolean;
}

/**
 * Organizations and the clinics a user works at, for the other modules (they don't reach into the repository).
 * Facilities are gone: a user's place of work is a clinic, with their `user_clinic_roles` there.
 */
@Injectable()
export class OrganizationsService {
	constructor(
		private readonly organizations: OrganizationRepository,
		private readonly clinics: ClinicDirectoryService,
		private readonly access: AccessService,
		private readonly config: ConfigService,
	) {}

	getGoogleConfig(): Promise<GoogleConfig> {
		return this.organizations.getGoogleConfig();
	}

	/**
	 * Setup of a self-hosted instance, on the caller's transaction: creates the default organization with the user as
	 * its ADMIN and, when LOOPWISE_DEFAULT_CLINIC_PATH is set, the default clinic with the user as SUPER_ADMIN + ADMIN
	 * there. Does nothing when an organization exists.
	 */
	async initializeDefaultOrganization(userId: string, tx: Prisma.TransactionClient): Promise<void> {
		const org = await this.organizations.createDefaultOrganization(userId, tx);
		const clinicPath = this.config.env.LOOPWISE_DEFAULT_CLINIC_PATH;
		if (!org || !clinicPath || (await this.clinics.getClinicByPath(clinicPath, tx))) {
			return;
		}
		const clinicName = clinicPath.split('/').pop() || 'Default Clinic';
		const clinic = await this.clinics.createClinic(
			{ name: clinicName, kind: 'local', path: clinicPath, organizationId: org.id },
			tx,
		);
		await this.clinics.grantClinicRoles(clinic.id, userId, ['SUPER_ADMIN', 'ADMIN'], tx);
	}

	getOrganizationsByIds(ids: readonly string[]): Promise<Organization[]> {
		return this.organizations.getOrganizationsByIds(ids);
	}

	/** Every clinic the user can open, by name, with their staff roles and access level there. */
	listUserClinics(userId: string): Promise<ClinicAccessGrant[]> {
		return this.access.listUserClinics(userId);
	}

	/**
	 * The organizations the user works in: those of their clinics plus their `organization_members` rows, by name. An
	 * organization ADMIN, or an admin at one of its clinics, administers it.
	 */
	async listUserOrganizations(userId: string): Promise<UserOrganization[]> {
		const [clinics, memberships] = await Promise.all([
			this.access.listUserClinics(userId),
			this.organizations.listUserOrganizations(userId),
		]);
		const byId = new Map<string, UserOrganization>();
		for (const { organization, role } of memberships) {
			byId.set(organization.id, { organization, isAdmin: role === 'ADMIN' });
		}
		const missing = [...new Set(clinics.map(({ clinic }) => clinic.organizationId).filter((id) => !byId.has(id)))];
		for (const organization of await this.organizations.getOrganizationsByIds(missing)) {
			byId.set(organization.id, { organization, isAdmin: false });
		}
		for (const { clinic, userRole } of clinics) {
			const entry = byId.get(clinic.organizationId);
			if (entry && userRole === 'admin') {
				entry.isAdmin = true;
			}
		}
		return [...byId.values()].sort((a, b) => a.organization.name.localeCompare(b.organization.name));
	}
}
