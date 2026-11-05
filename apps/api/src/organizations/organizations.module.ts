import { Module } from '@nestjs/common';

import { ClinicsCoreModule } from '../clinics/clinics-core.module.js';
import { OrganizationRepository } from './organization.repository.js';
import { OrganizationsService } from './organizations.service.js';

/**
 * Organizations, their members and first-user setup. Other modules use `OrganizationsService` (e.g. `listUserClinics`:
 * the user's clinics with their staff roles); the repository stays exported for auth and setup, which join its
 * transactions.
 */
@Module({
	imports: [ClinicsCoreModule],
	providers: [OrganizationRepository, OrganizationsService],
	exports: [OrganizationRepository, OrganizationsService],
})
export class OrganizationsModule {}
