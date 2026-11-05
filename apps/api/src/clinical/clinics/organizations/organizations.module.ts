import { Module } from '@nestjs/common';

import { ClinicsCoreModule } from '../clinics/clinics-core.module.js';
import { OrganizationRepository } from './organization.repository.js';
import { OrganizationsService } from './organizations.service.js';

/**
 * Organizations, their members and first-user setup. Other modules use `OrganizationsService` (Google sign-in
 * settings, `listUserClinics`: the user's clinics with their staff roles, `initializeDefaultOrganization` on the
 * setup's transaction); the repository stays inside the clinics domain.
 */
@Module({
	imports: [ClinicsCoreModule],
	providers: [OrganizationRepository, OrganizationsService],
	exports: [OrganizationsService],
})
export class OrganizationsModule {}
