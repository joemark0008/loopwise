import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

import { ProjectAccess, ProjectAdmin } from '../common/decorators/access.decorator.js';
import { CurrentProject } from '../common/decorators/current.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { Project } from '../generated/prisma/client.js';
import { ModelSettingsService } from './model-settings.service.js';

/**
 * Settings → Models and agent settings (upstream tRPC `project.getLlmConfigs` … `updateAgentSettings`). Payloads
 * are JSON in upstream's shapes, validated with upstream's zod schemas in the service.
 */
@Resolver()
export class ModelSettingsResolver {
	constructor(private readonly modelSettings: ModelSettingsService) {}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `project.getLlmConfigs`: provider configs, keys previewed.' })
	llmConfigs(@CurrentProject() project: Project) {
		return this.modelSettings.getLlmConfigs(project.id);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.upsertLlmConfig`.' })
	upsertLlmConfig(@CurrentProject() project: Project, @Args('input', { type: () => GraphQLJSON }) input: unknown) {
		return this.modelSettings.upsertLlmConfig(project.id, input);
	}

	@ProjectAdmin()
	@Mutation(() => Boolean)
	async deleteLlmConfig(@CurrentProject() project: Project, @Args('provider') provider: string) {
		await this.modelSettings.deleteLlmConfig(project.id, provider);
		return true;
	}

	@Public()
	@Query(() => GraphQLJSON, { description: 'Models known per provider (upstream `project.getKnownModels`).' })
	knownModels() {
		return this.modelSettings.getKnownModels();
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `project.getDefaultModels`.' })
	defaultModels(@CurrentProject() project: Project) {
		return this.modelSettings.getDefaultModels(project.id);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.updateDefaultModels`.' })
	updateDefaultModels(
		@CurrentProject() project: Project,
		@Args('settings', { type: () => GraphQLJSON }) settings: unknown,
	) {
		return this.modelSettings.updateDefaultModels(project.id, settings);
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, {
		description: 'Models the project can use (upstream `project.listAvailableTranscribeModels`, despite its name).',
	})
	availableModels(@CurrentProject() project: Project) {
		return this.modelSettings.getAvailableModels(project.id);
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { nullable: true, description: 'Upstream `project.getDefaultChatModel`.' })
	defaultChatModel(@CurrentProject() project: Project) {
		return this.modelSettings.getDefaultChatModel(project.id);
	}

	@ProjectAccess()
	@Query(() => GraphQLJSON, { description: 'Upstream `project.getAgentSettings`, with the instance capabilities.' })
	agentSettings(@CurrentProject() project: Project) {
		return this.modelSettings.getAgentSettings(project);
	}

	@ProjectAdmin()
	@Mutation(() => GraphQLJSON, { description: 'Upstream `project.updateAgentSettings`: merges each section.' })
	updateAgentSettings(
		@CurrentProject() project: Project,
		@Args('input', { type: () => GraphQLJSON }) input: unknown,
	) {
		return this.modelSettings.updateAgentSettings(project.id, input);
	}
}
