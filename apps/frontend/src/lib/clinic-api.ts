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
	ClinicSavedPromptsDocument,
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

type Inputs = ApiInputs['clinic'];
type Outputs = ApiOutputs['clinic'];

/**
 * Saved prompts, model/agent settings, display settings, synced tables and custom map boundary sets moved to apps/api (`lib/apollo-procedures.ts`): call sites swap
 * `clinic.*` for `clinicApi.clinic.*`.
 */
export const clinicApi = {
	clinic: {
		getDatabaseObjects: query<void, Outputs['getDatabaseObjects']>(
			['clinic', 'getDatabaseObjects'],
			async () => (await runQuery(DatabaseObjectsDocument, {})).databaseObjects,
		),
		getDisplaySettings: query<void, Outputs['getDisplaySettings']>(
			['clinic', 'getDisplaySettings'],
			async () => (await runQuery(DisplaySettingsDocument, {})).displaySettings as Outputs['getDisplaySettings'],
		),
		updateDisplaySettings: mutation<Inputs['updateDisplaySettings'], Outputs['updateDisplaySettings']>(
			['clinic', 'updateDisplaySettings'],
			async (input) =>
				(await runMutation(UpdateDisplaySettingsDocument, { input }))
					.updateDisplaySettings as Outputs['updateDisplaySettings'],
		),
		getSavedPrompts: query<void, Outputs['getSavedPrompts']>(['clinic', 'getSavedPrompts'], async () =>
			(await runQuery(SavedPromptsDocument, {})).savedPrompts.map(toSavedPrompt),
		),
		getClinicSavedPrompts: query<Inputs['getClinicSavedPrompts'], Outputs['getClinicSavedPrompts']>(
			['clinic', 'getClinicSavedPrompts'],
			async ({ clinicId }) =>
				(await runQuery(ClinicSavedPromptsDocument, { clinicId })).clinicSavedPrompts.map(toSavedPrompt),
		),
		createSavedPrompt: mutation<Inputs['createSavedPrompt'], Outputs['createSavedPrompt']>(
			['clinic', 'createSavedPrompt'],
			async (input) => toSavedPrompt((await runMutation(CreateSavedPromptDocument, { input })).createSavedPrompt),
		),
		updateSavedPrompt: mutation<Inputs['updateSavedPrompt'], Outputs['updateSavedPrompt']>(
			['clinic', 'updateSavedPrompt'],
			async ({ id, title, prompt }) =>
				toSavedPrompt(
					(await runMutation(UpdateSavedPromptDocument, { input: { promptId: id, title, prompt } }))
						.updateSavedPrompt,
				),
		),
		deleteSavedPrompt: mutation<Inputs['deleteSavedPrompt'], void>(
			['clinic', 'deleteSavedPrompt'],
			async ({ promptId }) => {
				await runMutation(DeleteSavedPromptDocument, { promptId });
			},
		),
		getLlmConfigs: query<void, Outputs['getLlmConfigs']>(['clinic', 'getLlmConfigs'], async () => {
			const { llmConfigs } = await runQuery(LlmConfigsDocument, {});
			const configs = llmConfigs as Outputs['getLlmConfigs'];
			return {
				...configs,
				clinicConfigs: configs.clinicConfigs.map((config) => ({
					...config,
					createdAt: new Date(config.createdAt),
					updatedAt: new Date(config.updatedAt),
				})),
			};
		}),
		upsertLlmConfig: mutation<Inputs['upsertLlmConfig'], Outputs['upsertLlmConfig']>(
			['clinic', 'upsertLlmConfig'],
			async (input) =>
				(await runMutation(UpsertLlmConfigDocument, { input })).upsertLlmConfig as Outputs['upsertLlmConfig'],
		),
		deleteLlmConfig: mutation<Inputs['deleteLlmConfig'], Outputs['deleteLlmConfig']>(
			['clinic', 'deleteLlmConfig'],
			async ({ provider }) => ({
				success: (await runMutation(DeleteLlmConfigDocument, { provider })).deleteLlmConfig,
			}),
		),
		getKnownModels: query<void, Outputs['getKnownModels']>(
			['clinic', 'getKnownModels'],
			async () => (await runQuery(KnownModelsDocument, {})).knownModels as Outputs['getKnownModels'],
		),
		getDefaultModels: query<void, Outputs['getDefaultModels']>(
			['clinic', 'getDefaultModels'],
			async () => (await runQuery(DefaultModelsDocument, {})).defaultModels as Outputs['getDefaultModels'],
		),
		updateDefaultModels: mutation<Inputs['updateDefaultModels'], Outputs['updateDefaultModels']>(
			['clinic', 'updateDefaultModels'],
			async (settings) =>
				(await runMutation(UpdateDefaultModelsDocument, { settings }))
					.updateDefaultModels as Outputs['updateDefaultModels'],
		),
		listAvailableTranscribeModels: query<void, Outputs['listAvailableTranscribeModels']>(
			['clinic', 'listAvailableTranscribeModels'],
			async () =>
				(await runQuery(AvailableModelsDocument, {}))
					.availableModels as Outputs['listAvailableTranscribeModels'],
		),
		getKnownTranscribeModels: query<void, Outputs['getKnownTranscribeModels']>(
			['clinic', 'getKnownTranscribeModels'],
			async () =>
				(await runQuery(KnownTranscribeModelsDocument, {}))
					.knownTranscribeModels as Outputs['getKnownTranscribeModels'],
		),
		getDefaultChatModel: query<void, Outputs['getDefaultChatModel']>(
			['clinic', 'getDefaultChatModel'],
			async () =>
				(await runQuery(DefaultChatModelDocument, {})).defaultChatModel as Outputs['getDefaultChatModel'],
		),
		getAgentSettings: query<void, Outputs['getAgentSettings']>(
			['clinic', 'getAgentSettings'],
			async () => (await runQuery(AgentSettingsDocument, {})).agentSettings as Outputs['getAgentSettings'],
		),
		updateAgentSettings: mutation<Inputs['updateAgentSettings'], Outputs['updateAgentSettings']>(
			['clinic', 'updateAgentSettings'],
			async (input) =>
				(await runMutation(UpdateAgentSettingsDocument, { input }))
					.updateAgentSettings as Outputs['updateAgentSettings'],
		),
		getMapBoundaries: query<void, Outputs['getMapBoundaries']>(
			['clinic', 'getMapBoundaries'],
			async () => (await runQuery(MapBoundariesDocument, {})).mapBoundaries as Outputs['getMapBoundaries'],
		),
		validateMapBoundaryUrl: mutation<Inputs['validateMapBoundaryUrl'], Outputs['validateMapBoundaryUrl']>(
			['clinic', 'validateMapBoundaryUrl'],
			async ({ url }) =>
				(await runMutation(ValidateMapBoundaryUrlDocument, { url }))
					.validateMapBoundaryUrl as Outputs['validateMapBoundaryUrl'],
		),
		addMapBoundary: mutation<Inputs['addMapBoundary'], Outputs['addMapBoundary']>(
			['clinic', 'addMapBoundary'],
			async (input) =>
				(await runMutation(AddMapBoundaryDocument, { input })).addMapBoundary as Outputs['addMapBoundary'],
		),
		updateMapBoundary: mutation<Inputs['updateMapBoundary'], Outputs['updateMapBoundary']>(
			['clinic', 'updateMapBoundary'],
			async (input) =>
				(await runMutation(UpdateMapBoundaryDocument, { input }))
					.updateMapBoundary as Outputs['updateMapBoundary'],
		),
		deleteMapBoundary: mutation<Inputs['deleteMapBoundary'], Outputs['deleteMapBoundary']>(
			['clinic', 'deleteMapBoundary'],
			async ({ key }) =>
				(await runMutation(DeleteMapBoundaryDocument, { key }))
					.deleteMapBoundary as Outputs['deleteMapBoundary'],
		),
	},
};

function toSavedPrompt<T extends { createdAt: string; updatedAt: string }>(prompt: T) {
	return { ...prompt, createdAt: new Date(prompt.createdAt), updatedAt: new Date(prompt.updatedAt) } as never;
}
