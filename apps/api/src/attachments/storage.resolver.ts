import type { UserRole } from '@loopwise/shared/types';
import { Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import type { AuthUser } from '../auth/auth.service.js';
import { ProjectAccess, ProjectAdmin, ProjectNonViewer } from '../common/decorators/access.decorator.js';
import { CurrentProject, CurrentUser, CurrentUserRole } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { AttachmentsService } from './attachments.service.js';

/** Settings → Storage and the chat input's upload limits (upstream tRPC `storage.*`), as JSON in upstream's shapes. */
@Resolver()
export class StorageResolver {
	constructor(private readonly attachments: AttachmentsService) {}

	@ProjectAdmin()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getConfig`: the storage backend, secrets masked.' })
	storageConfig() {
		return this.attachments.getConfig();
	}

	@ProjectAdmin()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getHealth`.' })
	storageHealth() {
		return this.attachments.getHealth();
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getUploadLimits`.' })
	storageUploadLimits() {
		return this.attachments.getUploadLimits();
	}

	/**
	 * Upstream `storage.getUsage` (`advancedSettingsProtectedProcedure`). loopwise has no user groups, so every User
	 * sees the advanced settings, as upstream's default group does: viewers are the ones left out.
	 */
	@ProjectNonViewer()
	@Query(() => GraphQLJSON, { description: 'Upstream `storage.getUsage`.' })
	storageUsage(
		@CurrentProject() project: Project,
		@CurrentUser() user: AuthUser,
		@CurrentUserRole() userRole: UserRole,
	) {
		return this.attachments.getUsage(project.id, user.id, userRole);
	}
}
