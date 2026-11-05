import { Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { ClinicAccess } from '../common/decorators/access.decorator.js';
import { CurrentClinic } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { TranscribeService } from './transcribe.service.js';

@Resolver()
export class TranscribeResolver {
	constructor(private readonly transcribeService: TranscribeService) {}

	@ClinicAccess()
	@Query(() => GraphQLJSON, {
		description:
			'Transcription models per provider and whether a key is set (upstream `getKnownTranscribeModels`).',
	})
	knownTranscribeModels(@CurrentClinic() clinic: Clinic) {
		return this.transcribeService.listAvailableTranscribeModels(clinic.id);
	}
}
