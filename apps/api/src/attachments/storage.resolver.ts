import type { UserRole } from '@loopwise/shared/types';
import { Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthUser } from '../auth/auth.service.js';
import { ClinicAccess, ClinicAdmin, ClinicNonViewer } from '../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser, CurrentUserRole } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { AttachmentsService } from './attachments.service.js';

/** Settings → Storage and the chat input's upload limits (upstream tRPC `storage.*`), as JSON in upstream's shapes. */
@Resolver()
export class StorageResolver {
	constructor(private readonly attachments: AttachmentsService) {}

	@ClinicAdmin()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getConfig`: the storage backend, secrets masked.' })
	storageConfig() {
		return this.attachments.getConfig();
	}

	@ClinicAdmin()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getHealth`.' })
	storageHealth() {
		return this.attachments.getHealth();
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getUploadLimits`.' })
	storageUploadLimits() {
		return this.attachments.getUploadLimits();
	}

	/**
	 * Upstream `storage.getUsage` (`advancedSettingsProtectedProcedure`). loopwise has no user groups, so every User
	 * sees the advanced settings, as upstream's default group does: viewers are the ones left out.
	 */
	@ClinicNonViewer()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getUsage`.' })
	storageUsage(
		@CurrentClinic() clinic: Clinic,
		@CurrentUser() user: AuthUser,
		@CurrentUserRole() userRole: UserRole,
	) {
		return this.attachments.getUsage(clinic.id, user.id, userRole);
	}
}
