import type { LlmProvider } from '@loopwise/shared/types';

import { KNOWN_MODELS } from '../agent/providers/provider-meta.js';
import type { CustomModelMetadata, ModelCosts } from '../agent/types/llm.js';

/** USD per million tokens of one model, a row of the `cost_lookup` table the usage queries join. */
export interface ModelCostRow {
	provider: string;
	modelId: string;
	inputNoCache: number;
	inputCacheRead: number;
	inputCacheWrite: number;
	output: number;
}

/**
 * Upstream `getCostLookupTuples`: the catalogue prices of every known model, overridden by the prices a project
 * declares for its custom models (Settings → Agent).
 */
export function buildModelCostRows(
	declaredModels: Array<{ provider: LlmProvider; models: CustomModelMetadata[] }>,
): ModelCostRow[] {
	const costs = new Map<string, ModelCosts>();

	for (const [provider, models] of Object.entries(KNOWN_MODELS)) {
		for (const model of models) {
			costs.set(`${provider}\u0000${model.id}`, { ...model.costPerM });
		}
	}

	for (const { provider, models } of declaredModels) {
		for (const model of models) {
			const key = `${provider}\u0000${model.id}`;
			costs.set(key, { ...costs.get(key), ...model.costPerM });
		}
	}

	return [...costs].map(([key, cost]) => {
		const [provider, modelId] = key.split('\u0000');
		return {
			provider,
			modelId,
			inputNoCache: cost.inputNoCache ?? 0,
			inputCacheRead: cost.inputCacheRead ?? 0,
			inputCacheWrite: cost.inputCacheWrite ?? 0,
			output: cost.output ?? 0,
		};
	});
}
