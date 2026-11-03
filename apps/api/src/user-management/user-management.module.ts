import { Module } from '@nestjs/common';

import { UserManagementRepository } from './user-management.repository.js';
import { UserManagementResolver } from './user-management.resolver.js';
import { UserManagementService } from './user-management.service.js';

/** Admin-created users, their roles and status, and the one-time links they set their password with. */
@Module({
	providers: [UserManagementResolver, UserManagementService, UserManagementRepository],
})
export class UserManagementModule {}
