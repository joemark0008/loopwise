import { Module } from '@nestjs/common';

import { ProjectRepository } from './project.repository.js';

/** Project lookup and membership, for the modules the full `ProjectsModule` depends on (guards, organizations). */
@Module({
	providers: [ProjectRepository],
	exports: [ProjectRepository],
})
export class ProjectsCoreModule {}
