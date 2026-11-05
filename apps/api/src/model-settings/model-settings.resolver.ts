import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { ClinicAccess, ClinicAdmin } from '../common/decorators/access.decorator.js';
import { CurrentClinic } from '../common/decorators/current.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { ModelSettingsService } from './model-settings.service.js';

/**
 * Settings → Models and agent settings (upstream tRPC `clinic.getLlmConfigs` … `updateAgentSettings`). Payloads
 * are JSON in upstream's shapes, validated with upstream's zod schemas in the service.
 */
@Resolver()
export class ModelSettingsResolver {
	constructor(private readonly modelSettings: ModelSettingsService) {}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `clinic.getLlmConfigs`: provider configs, keys previewed.' })
	llmConfigs(@CurrentClinic() clinic: Clinic) {
		return this.modelSettings.getLlmConfigs(clinic.id);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.upsertLlmConfig`.' })
	upsertLlmConfig(@CurrentClinic() clinic: Clinic, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.modelSettings.upsertLlmConfig(clinic.id, input);
	}

	@ClinicAdmin()
	@Mutation(() => Boolean)
	async deleteLlmConfig(@CurrentClinic() clinic: Clinic, @Args('provider') provider: string) {
		await this.modelSettings.deleteLlmConfig(clinic.id, provider);
		return true;
	}

	@Public()
	@Query(() => GraphQLJSON, { description: 'Models known per provider (upstream `clinic.getKnownModels`).' })
	knownModels() {
		return this.modelSettings.getKnownModels();
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `clinic.getDefaultModels`.' })
	defaultModels(@CurrentClinic() clinic: Clinic) {
		return this.modelSettings.getDefaultModels(clinic.id);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.updateDefaultModels`.' })
	updateDefaultModels(
		@CurrentClinic() clinic: Clinic,
		@Args('settings', { type: () => GraphQLJSON }) settings: unknown,
	) {
		return this.modelSettings.updateDefaultModels(clinic.id, settings);
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, {
		description: 'Models the clinic can use (upstream `clinic.listAvailableTranscribeModels`, despite its name).',
	})
	availableModels(@CurrentClinic() clinic: Clinic) {
		return this.modelSettings.getAvailableModels(clinic.id);
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { nullable: true, description: 'Upstream `clinic.getDefaultChatModel`.' })
	defaultChatModel(@CurrentClinic() clinic: Clinic) {
		return this.modelSettings.getDefaultChatModel(clinic.id);
	}

	@ClinicAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `clinic.getAgentSettings`, with the instance capabilities.' })
	agentSettings(@CurrentClinic() clinic: Clinic) {
		return this.modelSettings.getAgentSettings(clinic);
	}

	@ClinicAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `clinic.updateAgentSettings`: merges each section.' })
	updateAgentSettings(@CurrentClinic() clinic: Clinic, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.modelSettings.updateAgentSettings(clinic.id, input);
	}
}
