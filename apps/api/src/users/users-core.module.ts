import { Module } from '@nestjs/common';

import { UserRepository } from './user.repository.js';

/** The user repository, shared by the auth module and the users module (no resolvers). */
@Module({
	providers: [UserRepository],
	exports: [UserRepository],
})
export class UsersCoreModule {}
