import { Module } from '@nestjs/common';

import { UserLoader } from './user.loader.js';
import { UsersResolver } from './users.resolver.js';
import { UsersService } from './users.service.js';
import { UsersCoreModule } from './users-core.module.js';

@Module({
	imports: [UsersCoreModule],
	providers: [UsersResolver, UsersService, UserLoader],
	exports: [UsersService, UserLoader],
})
export class UsersModule {}
