import { Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { ProjectAccess } from '../common/decorators/access.decorator.js';
import { CurrentProject } from '../common/decorators/current.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { TranscribeService } from './transcribe.service.js';

@Resolver()
export class TranscribeResolver {
	constructor(private readonly transcribeService: TranscribeService) {}

	@ProjectAccess()
	@Query(() => GraphQLJSON, {
		description:
			'Transcription models per provider and whether a key is set (upstream `getKnownTranscribeModels`).',
	})
	knownTranscribeModels(@CurrentProject() project: Project) {
		return this.transcribeService.listAvailableTranscribeModels(project.id);
	}
}
