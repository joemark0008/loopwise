import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { UsersCoreModule } from '../users/users-core.module.js';
import { SetupRepository } from './setup.repository.js';
import { SetupResolver } from './setup.resolver.js';
import { SetupService } from './setup.service.js';

@Module({
	imports: [UsersCoreModule, OrganizationsModule],
	providers: [SetupService, SetupRepository, SetupResolver],
})
export class SetupModule {}
