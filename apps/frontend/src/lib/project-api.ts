import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	AddMapBoundaryDocument,
	AgentSettingsDocument,
	AvailableModelsDocument,
	CreateSavedPromptDocument,
	DatabaseObjectsDocument,
	DefaultChatModelDocument,
	DefaultModelsDocument,
	DeleteLlmConfigDocument,
	DeleteMapBoundaryDocument,
	DeleteSavedPromptDocument,
	DisplaySettingsDocument,
	KnownModelsDocument,
	KnownTranscribeModelsDocument,
	LlmConfigsDocument,
	MapBoundariesDocument,
	ProjectSavedPromptsDocument,
	SavedPromptsDocument,
	UpdateAgentSettingsDocument,
	UpdateDefaultModelsDocument,
	UpdateDisplaySettingsDocument,
	UpdateMapBoundaryDocument,
	UpdateSavedPromptDocument,
	UpsertLlmConfigDocument,
	ValidateMapBoundaryUrlDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['project'];
type Outputs = ApiOutputs['project'];

/**
 * Saved prompts, model/agent settings, display settings, synced tables and custom map boundary sets moved to apps/api (`lib/apollo-procedures.ts`): call sites swap
 * `project.*` for `projectApi.project.*`.
 */
export const projectApi = {
	project: {
		getDatabaseObjects: query<void, Outputs['getDatabaseObjects']>(
			['project', 'getDatabaseObjects'],
			async () => (await runQuery(DatabaseObjectsDocument, {})).databaseObjects,
		),
		getDisplaySettings: query<void, Outputs['getDisplaySettings']>(
			['project', 'getDisplaySettings'],
			async () => (await runQuery(DisplaySettingsDocument, {})).displaySettings as Outputs['getDisplaySettings'],
		),
		updateDisplaySettings: mutation<Inputs['updateDisplaySettings'], Outputs['updateDisplaySettings']>(
			['project', 'updateDisplaySettings'],
			async (input) =>
				(await runMutation(UpdateDisplaySettingsDocument, { input }))
					.updateDisplaySettings as Outputs['updateDisplaySettings'],
		),
		getSavedPrompts: query<void, Outputs['getSavedPrompts']>(['project', 'getSavedPrompts'], async () =>
			(await runQuery(SavedPromptsDocument, {})).savedPrompts.map(toSavedPrompt),
		),
		getProjectSavedPrompts: query<Inputs['getProjectSavedPrompts'], Outputs['getProjectSavedPrompts']>(
			['project', 'getProjectSavedPrompts'],
			async ({ projectId }) =>
				(await runQuery(ProjectSavedPromptsDocument, { projectId })).projectSavedPrompts.map(toSavedPrompt),
		),
		createSavedPrompt: mutation<Inputs['createSavedPrompt'], Outputs['createSavedPrompt']>(
			['project', 'createSavedPrompt'],
			async (input) => toSavedPrompt((await runMutation(CreateSavedPromptDocument, { input })).createSavedPrompt),
		),
		updateSavedPrompt: mutation<Inputs['updateSavedPrompt'], Outputs['updateSavedPrompt']>(
			['project', 'updateSavedPrompt'],
			async ({ id, title, prompt }) =>
				toSavedPrompt(
					(await runMutation(UpdateSavedPromptDocument, { input: { promptId: id, title, prompt } }))
						.updateSavedPrompt,
				),
		),
		deleteSavedPrompt: mutation<Inputs['deleteSavedPrompt'], void>(
			['project', 'deleteSavedPrompt'],
			async ({ promptId }) => {
				await runMutation(DeleteSavedPromptDocument, { promptId });
			},
		),
		getLlmConfigs: query<void, Outputs['getLlmConfigs']>(['project', 'getLlmConfigs'], async () => {
			const { llmConfigs } = await runQuery(LlmConfigsDocument, {});
			const configs = llmConfigs as Outputs['getLlmConfigs'];
			return {
				...configs,
				projectConfigs: configs.projectConfigs.map((config) => ({
					...config,
					createdAt: new Date(config.createdAt),
					updatedAt: new Date(config.updatedAt),
				})),
			};
		}),
		upsertLlmConfig: mutation<Inputs['upsertLlmConfig'], Outputs['upsertLlmConfig']>(
			['project', 'upsertLlmConfig'],
			async (input) =>
				(await runMutation(UpsertLlmConfigDocument, { input })).upsertLlmConfig as Outputs['upsertLlmConfig'],
		),
		deleteLlmConfig: mutation<Inputs['deleteLlmConfig'], Outputs['deleteLlmConfig']>(
			['project', 'deleteLlmConfig'],
			async ({ provider }) => ({
				success: (await runMutation(DeleteLlmConfigDocument, { provider })).deleteLlmConfig,
			}),
		),
		getKnownModels: query<void, Outputs['getKnownModels']>(
			['project', 'getKnownModels'],
			async () => (await runQuery(KnownModelsDocument, {})).knownModels as Outputs['getKnownModels'],
		),
		getDefaultModels: query<void, Outputs['getDefaultModels']>(
			['project', 'getDefaultModels'],
			async () => (await runQuery(DefaultModelsDocument, {})).defaultModels as Outputs['getDefaultModels'],
		),
		updateDefaultModels: mutation<Inputs['updateDefaultModels'], Outputs['updateDefaultModels']>(
			['project', 'updateDefaultModels'],
			async (settings) =>
				(await runMutation(UpdateDefaultModelsDocument, { settings }))
					.updateDefaultModels as Outputs['updateDefaultModels'],
		),
		listAvailableTranscribeModels: query<void, Outputs['listAvailableTranscribeModels']>(
			['project', 'listAvailableTranscribeModels'],
			async () =>
				(await runQuery(AvailableModelsDocument, {}))
					.availableModels as Outputs['listAvailableTranscribeModels'],
		),
		getKnownTranscribeModels: query<void, Outputs['getKnownTranscribeModels']>(
			['project', 'getKnownTranscribeModels'],
			async () =>
				(await runQuery(KnownTranscribeModelsDocument, {}))
					.knownTranscribeModels as Outputs['getKnownTranscribeModels'],
		),
		getDefaultChatModel: query<void, Outputs['getDefaultChatModel']>(
			['project', 'getDefaultChatModel'],
			async () =>
				(await runQuery(DefaultChatModelDocument, {})).defaultChatModel as Outputs['getDefaultChatModel'],
		),
		getAgentSettings: query<void, Outputs['getAgentSettings']>(
			['project', 'getAgentSettings'],
			async () => (await runQuery(AgentSettingsDocument, {})).agentSettings as Outputs['getAgentSettings'],
		),
		updateAgentSettings: mutation<Inputs['updateAgentSettings'], Outputs['updateAgentSettings']>(
			['project', 'updateAgentSettings'],
			async (input) =>
				(await runMutation(UpdateAgentSettingsDocument, { input }))
					.updateAgentSettings as Outputs['updateAgentSettings'],
		),
		getMapBoundaries: query<void, Outputs['getMapBoundaries']>(
			['project', 'getMapBoundaries'],
			async () => (await runQuery(MapBoundariesDocument, {})).mapBoundaries as Outputs['getMapBoundaries'],
		),
		validateMapBoundaryUrl: mutation<Inputs['validateMapBoundaryUrl'], Outputs['validateMapBoundaryUrl']>(
			['project', 'validateMapBoundaryUrl'],
			async ({ url }) =>
				(await runMutation(ValidateMapBoundaryUrlDocument, { url }))
					.validateMapBoundaryUrl as Outputs['validateMapBoundaryUrl'],
		),
		addMapBoundary: mutation<Inputs['addMapBoundary'], Outputs['addMapBoundary']>(
			['project', 'addMapBoundary'],
			async (input) =>
				(await runMutation(AddMapBoundaryDocument, { input })).addMapBoundary as Outputs['addMapBoundary'],
		),
		updateMapBoundary: mutation<Inputs['updateMapBoundary'], Outputs['updateMapBoundary']>(
			['project', 'updateMapBoundary'],
			async (input) =>
				(await runMutation(UpdateMapBoundaryDocument, { input }))
					.updateMapBoundary as Outputs['updateMapBoundary'],
		),
		deleteMapBoundary: mutation<Inputs['deleteMapBoundary'], Outputs['deleteMapBoundary']>(
			['project', 'deleteMapBoundary'],
			async ({ key }) =>
				(await runMutation(DeleteMapBoundaryDocument, { key }))
					.deleteMapBoundary as Outputs['deleteMapBoundary'],
		),
	},
};

function toSavedPrompt<T extends { createdAt: string; updatedAt: string }>(prompt: T) {
	return { ...prompt, createdAt: new Date(prompt.createdAt), updatedAt: new Date(prompt.updatedAt) } as never;
}
