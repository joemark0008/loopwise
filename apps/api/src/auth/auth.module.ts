import { Global, Module } from '@nestjs/common';

import { OrganizationsModule } from '../clinical/clinics/organizations/organizations.module.js';
import { UsersCoreModule } from '../users/users-core.module.js';
import { AuthMiddleware } from './auth.middleware.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
	imports: [OrganizationsModule, UsersCoreModule],
	providers: [AuthService, AuthMiddleware],
	exports: [AuthService, AuthMiddleware],
})
export class AuthModule {}
