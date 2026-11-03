import { getDefaultModelId } from '@loopwise/api/agent/providers/provider-meta';
import type { ModelInferenceSettings, ModelSettingsMap } from '@loopwise/api/agent/types/llm';
import type { LlmProvider } from '@loopwise/shared/types';

interface ApplySavedModelSettingsArgs {
	provider: LlmProvider;
	enabledModels: string[];
	modelSettings: ModelSettingsMap;
	modelId: string;
	settings: ModelInferenceSettings;
}

interface ApplySavedModelSettingsResult {
	enabledModels: string[];
	modelSettings: ModelSettingsMap;
}

export function applySavedModelSettings({
	provider,
	enabledModels,
	modelSettings,
	modelId,
	settings,
}: ApplySavedModelSettingsArgs): ApplySavedModelSettingsResult {
	const nextModelSettings = upsertModelSettings(modelSettings, modelId, settings);
	if (!hasModelSettingOverrides(settings) || enabledModels.length > 0 || modelId !== getDefaultModelId(provider)) {
		return { enabledModels, modelSettings: nextModelSettings };
	}
	return { enabledModels: [modelId], modelSettings: nextModelSettings };
}

function upsertModelSettings(
	modelSettings: ModelSettingsMap,
	modelId: string,
	settings: ModelInferenceSettings,
): ModelSettingsMap {
	if (hasModelSettingOverrides(settings)) {
		return { ...modelSettings, [modelId]: settings };
	}
	const { [modelId]: _removed, ...nextModelSettings } = modelSettings;
	return nextModelSettings;
}

function hasModelSettingOverrides(settings: ModelInferenceSettings): boolean {
	return Object.keys(settings).length > 0;
}
