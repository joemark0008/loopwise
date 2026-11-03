import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { ProjectsCoreModule } from '../../projects/projects-core.module.js';
import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
	imports: [ProjectsCoreModule, OrganizationsModule],
	providers: [AccessService, { provide: APP_GUARD, useClass: AuthGuard }],
	exports: [AccessService],
})
export class GuardsModule {}
