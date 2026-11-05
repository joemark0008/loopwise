import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isManagedProvider, PROVIDER_META } from '@loopwise/api/agent/providers/provider-meta';
import {
	LLM_PROVIDERS,
	NAMED_PROVIDER_KIND,
	providerKind,
	providerName,
	toNamedProvider,
	toProviderName,
} from '@loopwise/shared/types';
import type { CustomModelMetadata, ModelSettingsMap } from '@loopwise/api/agent/types/llm';
import type { LlmProvider, LlmProviderKind } from '@loopwise/shared/types';
import type { InheritedKeySource } from '@/feature/settings/components/llm-provider-form';
import { clinicApi } from '@/lib/clinic-api';

export interface EditingState {
	provider: LlmProvider;
	isEditing: boolean;
	inheritedKeySource: InheritedKeySource | null;
	focusedModelId?: string;
	initialValues?: {
		enabledModels: string[];
		customModels: CustomModelMetadata[];
		modelSettings: ModelSettingsMap;
		baseUrl: string;
	};
}

export function useLlmProviders() {
	const queryClient = useQueryClient();

	// Queries
	const llmConfigs = useQuery(clinicApi.clinic.getLlmConfigs.queryOptions());
	const knownModels = useQuery(clinicApi.clinic.getKnownModels.queryOptions());

	// Mutations
	const upsertLlmConfig = useMutation(clinicApi.clinic.upsertLlmConfig.mutationOptions());
	const deleteLlmConfig = useMutation(clinicApi.clinic.deleteLlmConfig.mutationOptions());

	// Local state
	const [editingState, setEditingState] = useState<EditingState | null>(null);

	// Derived data
	const clinicConfigs = llmConfigs.data?.clinicConfigs ?? [];
	const configProviders = llmConfigs.data?.configProviders ?? [];
	const envProviders = llmConfigs.data?.envProviders ?? [];
	const envBaseUrls = llmConfigs.data?.envBaseUrls ?? {};
	const clinicConfiguredProviders = clinicConfigs.map((c) => c.provider);

	// Kinds that accept several instances stay on offer: each new one is added under its own name.
	const availableProvidersToAdd: LlmProviderKind[] = LLM_PROVIDERS.filter(
		(p) =>
			!isManagedProvider(p) &&
			(p === NAMED_PROVIDER_KIND ||
				(!clinicConfiguredProviders.includes(p) &&
					!envProviders.includes(p) &&
					!configProviders.some((c) => c.provider === p))),
	);

	// Names already in use, so that adding an endpoint cannot silently overwrite one of them.
	const takenProviderNames = [...clinicConfiguredProviders, ...configProviders.map((c) => c.provider)]
		.map(providerName)
		.filter((name): name is string => name !== null);

	const unconfiguredEnvProviders = envProviders.filter((p) => !clinicConfiguredProviders.includes(p));

	const unconfiguredConfigProviders = configProviders.filter((c) => !clinicConfiguredProviders.includes(c.provider));

	const currentModels =
		editingState?.provider && knownModels.data ? knownModels.data[providerKind(editingState.provider)] : [];

	const resolveInheritedKeySource = (provider: LlmProvider): InheritedKeySource | null => {
		if (configProviders.some((c) => c.provider === provider)) {
			return 'config';
		}
		if (envProviders.includes(provider)) {
			return 'env';
		}
		return null;
	};

	// Handlers
	const invalidateQueries = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: clinicApi.clinic.getLlmConfigs.queryOptions().queryKey }),
			queryClient.invalidateQueries({
				queryKey: clinicApi.clinic.listAvailableTranscribeModels.queryOptions().queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: clinicApi.clinic.getKnownTranscribeModels.queryOptions().queryKey,
			}),
			queryClient.invalidateQueries({ queryKey: clinicApi.clinic.getDefaultModels.queryOptions().queryKey }),
			queryClient.invalidateQueries({ queryKey: clinicApi.clinic.getDefaultChatModel.queryOptions().queryKey }),
		]);
	};

	const handleSubmit = async (values: {
		apiKey?: string;
		credentials?: Record<string, string>;
		name?: string;
		enabledModels: string[];
		customModels: CustomModelMetadata[];
		modelSettings: ModelSettingsMap;
		baseUrl?: string;
	}) => {
		if (!editingState?.provider) {
			return;
		}

		const provider = resolveSubmittedProvider(editingState.provider, values.name);
		const name = providerName(provider);
		if (!editingState.isEditing && name && takenProviderNames.includes(name)) {
			throw new Error(`An endpoint named '${name}' already exists`);
		}

		await upsertLlmConfig.mutateAsync({
			provider,
			apiKey: values.apiKey,
			credentials: values.credentials,
			enabledModels: values.enabledModels,
			customModels: values.customModels,
			modelSettings: values.modelSettings,
			baseUrl: values.baseUrl,
		});
		await invalidateQueries();
		setEditingState(null);
		upsertLlmConfig.reset();
	};

	const handleCancel = () => {
		setEditingState(null);
		upsertLlmConfig.reset();
	};

	const handleEditConfig = (config: (typeof clinicConfigs)[0]) => {
		setEditingState({
			provider: config.provider,
			isEditing: true,
			inheritedKeySource: resolveInheritedKeySource(config.provider),
			initialValues: {
				enabledModels: config.enabledModels ?? [],
				customModels: config.customModels ?? [],
				modelSettings: config.modelSettings ?? {},
				baseUrl: config.baseUrl ?? '',
			},
		});
	};

	/** Seed the form with the loopwise_config.yaml values so saving creates an override of them. */
	const handleOverrideConfigProvider = (configProvider: (typeof configProviders)[0]) => {
		setEditingState({
			provider: configProvider.provider,
			isEditing: true,
			inheritedKeySource: 'config',
			initialValues: {
				enabledModels: configProvider.enabledModels,
				customModels: configProvider.customModels,
				modelSettings: configProvider.modelSettings,
				baseUrl: configProvider.baseUrl ?? '',
			},
		});
	};

	const handleDeleteConfig = async (provider: LlmProvider) => {
		await deleteLlmConfig.mutateAsync({ provider });
		await invalidateQueries();
	};

	const handleSelectProvider = (provider: LlmProvider) => {
		// Adding a provider of the named kind creates an endpoint of its own, with credentials of its own.
		const inheritsCredentials = providerKind(provider) !== NAMED_PROVIDER_KIND;
		setEditingState({
			provider,
			isEditing: false,
			inheritedKeySource: inheritsCredentials ? resolveInheritedKeySource(provider) : null,
		});
	};

	const handleConfigureEnvProvider = (provider: LlmProvider) => {
		// Endpoints loopwise cannot guess start from the environment value rather than an empty field.
		const baseUrl = PROVIDER_META[providerKind(provider)].requiresBaseUrl ? (envBaseUrls[provider] ?? '') : '';
		setEditingState({
			provider,
			isEditing: true,
			inheritedKeySource: 'env',
			initialValues: { enabledModels: [], customModels: [], modelSettings: {}, baseUrl },
		});
	};

	/** Open a provider's form, optionally on one of its models, wherever the provider is declared. */
	const handleEditProvider = (provider: LlmProvider, focusedModelId?: string) => {
		openProviderForm(provider);
		setEditingState((state) => (state?.provider === provider ? { ...state, focusedModelId } : state));
	};

	const openProviderForm = (provider: LlmProvider) => {
		const clinicConfig = clinicConfigs.find((c) => c.provider === provider);
		if (clinicConfig) {
			handleEditConfig(clinicConfig);
			return;
		}
		const configProvider = configProviders.find((c) => c.provider === provider);
		if (configProvider) {
			handleOverrideConfigProvider(configProvider);
			return;
		}
		if (envProviders.includes(provider)) {
			handleConfigureEnvProvider(provider);
		}
	};

	const getModelDisplayName = (provider: LlmProvider, modelId: string) => {
		const models = knownModels.data?.[providerKind(provider)] ?? [];
		const knownName = models.find((m) => m.id === modelId)?.name;
		if (knownName) {
			return knownName;
		}
		const customModel = findCustomModel(provider, modelId);
		return customModel?.displayName?.trim() || modelId;
	};

	const findCustomModel = (provider: LlmProvider, modelId: string) => {
		const fromClinicConfig = clinicConfigs
			.find((c) => c.provider === provider)
			?.customModels?.find((m) => m.id === modelId);
		if (fromClinicConfig) {
			return fromClinicConfig;
		}
		return configProviders.find((c) => c.provider === provider)?.customModels.find((m) => m.id === modelId);
	};

	return {
		// Data
		clinicConfigs,
		configProviders,
		envProviders,
		envBaseUrls,
		availableProvidersToAdd,
		takenProviderNames,
		unconfiguredEnvProviders,
		unconfiguredConfigProviders,
		currentModels,
		isLoaded: llmConfigs.isSuccess && knownModels.isSuccess,

		// State
		editingState,

		// Mutation state
		upsertPending: upsertLlmConfig.isPending,
		upsertError: upsertLlmConfig.error,
		deletePending: deleteLlmConfig.isPending,

		// Handlers
		handleSubmit,
		handleCancel,
		handleEditConfig,
		handleOverrideConfigProvider,
		handleDeleteConfig,
		handleSelectProvider,
		handleConfigureEnvProvider,
		handleEditProvider,
		getModelDisplayName,
	};
}

/** A provider the admin named is saved under that name, so the clinic can hold several of its kind. */
function resolveSubmittedProvider(provider: LlmProvider, name?: string): LlmProvider {
	const instanceName = name ? toProviderName(name) : null;
	return instanceName ? toNamedProvider(instanceName) : provider;
}
