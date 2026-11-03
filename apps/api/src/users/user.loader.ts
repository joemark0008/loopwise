import { Injectable } from '@nestjs/common';

import { LoaderFactory, orderByKeys } from '../common/dataloader/loader-factory.js';
import type { User } from '../generated/prisma/client.js';
import { UserRepository } from './user.repository.js';

/** Users by id, batched per request (chat authors, members, …). */
@Injectable()
export class UserLoader extends LoaderFactory<string, User> {
	constructor(private readonly users: UserRepository) {
		super();
	}

	async batch(ids: readonly string[]) {
		return orderByKeys(ids, await this.users.getUsersByIds(ids), (user) => user.id);
	}
}
