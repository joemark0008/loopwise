import crypto from 'node:crypto';

import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { hashPassword } from 'better-auth/crypto';

import { OrganizationsService } from '../clinical/clinics/organizations/organizations.service.js';
import { HandlerError } from '../common/errors/handler-error.js';
import { ConfigService } from '../config/config.service.js';
import { UserRepository } from '../users/user.repository.js';
import type { CompleteSetupInput } from './dto/complete-setup.input.js';
import { SetupRepository } from './setup.repository.js';
import { deriveSetupToken, isValidSetupToken } from './setup-token.js';

@Injectable()
export class SetupService implements OnApplicationBootstrap {
	private readonly logger = new Logger(SetupService.name);

	constructor(
		private readonly config: ConfigService,
		private readonly users: UserRepository,
		private readonly setup: SetupRepository,
		private readonly organizations: OrganizationsService,
	) {}

	/** On an empty instance, prints the setup token and URL: the only place the token is ever shown. */
	async onApplicationBootstrap(): Promise<void> {
		if ((await this.users.countUsers()) > 0) {
			return;
		}
		const { BETTER_AUTH_SECRET } = this.config.env;
		this.logger.log(
			`Loopwise is not set up yet. Open ${this.config.baseUrl}/setup and enter this setup token: ${deriveSetupToken(BETTER_AUTH_SECRET)}`,
		);
	}

	async completeSetup(input: CompleteSetupInput): Promise<void> {
		if (!isValidSetupToken(input.token, this.config.env.BETTER_AUTH_SECRET)) {
			throw new HandlerError('FORBIDDEN', 'Invalid setup token.');
		}

		const password = await hashPassword(input.password);
		const userId = crypto.randomUUID();
		await this.setup.createFirstAdmin(
			{ id: userId, name: input.name, email: input.email, emailVerified: true },
			{ id: crypto.randomUUID(), accountId: userId, providerId: 'credential', password },
			(created, tx) => this.organizations.initializeDefaultOrganization(created.id, tx),
		);
	}
}
