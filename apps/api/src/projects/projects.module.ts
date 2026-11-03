import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ProjectSavedPromptRepository } from './project-saved-prompt.repository.js';
import { ProjectsResolver } from './projects.resolver.js';
import { ProjectsService } from './projects.service.js';
import { ProjectsCoreModule } from './projects-core.module.js';

/** Port of upstream trpc `project` (core: list, current, create, rename, delete, saved prompts). */
@Module({
	imports: [ProjectsCoreModule, OrganizationsModule],
	providers: [ProjectSavedPromptRepository, ProjectsService, ProjectsResolver],
	exports: [ProjectsCoreModule, ProjectsService],
})
export class ProjectsModule {}
