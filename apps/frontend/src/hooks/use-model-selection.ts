import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { LlmSelectedModel } from '@loopwise/shared/types';
import { useAgentContext } from '@/contexts/agent.provider';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { clinicApi } from '@/lib/clinic-api';

export function useModelSelection() {
	const { selectedModel, usesDefaultModel, setSelectedModel } = useAgentContext();
	const currentClinicQuery = useCurrentClinic();
	const hasClinic = currentClinicQuery.isError || currentClinicQuery.data != null;
	const availableModelsQuery = useQuery({
		...clinicApi.clinic.listAvailableTranscribeModels.queryOptions(),
		enabled: hasClinic,
	});
	const defaultModelQuery = useQuery({
		...clinicApi.clinic.getDefaultChatModel.queryOptions(),
		enabled: hasClinic,
	});
	const availableModels = hasClinic ? availableModelsQuery.data : undefined;
	const isPending = currentClinicQuery.isPending || (hasClinic && availableModelsQuery.isPending);
	const canCycleModels = (availableModels?.length ?? 0) > 1;

	/** Cycles through "loopwise default" followed by every available model. */
	const cycleModel = useCallback(() => {
		if (!availableModels || availableModels.length < 2) {
			return;
		}
		if (usesDefaultModel) {
			setSelectedModel(availableModels[0]);
			return;
		}
		const currentIndex = availableModels.findIndex((model) => isSameModel(model, selectedModel));
		const nextModel = availableModels[currentIndex + 1] ?? null;
		setSelectedModel(nextModel);
	}, [availableModels, usesDefaultModel, selectedModel, setSelectedModel]);

	return {
		availableModels,
		defaultModel: hasClinic ? (defaultModelQuery.data ?? null) : null,
		selectedModel,
		usesDefaultModel,
		setSelectedModel,
		isPending,
		canCycleModels,
		cycleModel,
		hasClinic,
	};
}

export function isSameModel(model: LlmSelectedModel, other: LlmSelectedModel | null): boolean {
	return !!other && model.provider === other.provider && model.modelId === other.modelId;
}
