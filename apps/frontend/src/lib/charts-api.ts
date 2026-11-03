import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	ChartDownloadDocument,
	ChartPluginsDocument,
	ChartPluginSourceDocument,
	UpdateChartConfigDocument,
	UpdateMapConfigDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs;
type Outputs = ApiOutputs;

/**
 * Chart download, chart and map config edits, and chart plugins moved to apps/api (`lib/apollo-procedures.ts`):
 * call sites swap upstream tRPC's `chart.*`, `map.*` and `chartPlugin.*` for `chartsApi.*`.
 */
export const chartsApi = {
	chart: {
		download: query<Inputs['chart']['download'], Outputs['chart']['download']>(
			['chart', 'download'],
			async ({ toolCallId }) => (await runQuery(ChartDownloadDocument, { toolCallId })).chartDownload,
		),
		updateConfig: mutation<Inputs['chart']['updateConfig'], Outputs['chart']['updateConfig']>(
			['chart', 'updateConfig'],
			async ({ toolCallId, config }) => {
				await runMutation(UpdateChartConfigDocument, { toolCallId, config });
				return { success: true as const };
			},
		),
	},
	map: {
		updateConfig: mutation<Inputs['map']['updateConfig'], Outputs['map']['updateConfig']>(
			['map', 'updateConfig'],
			async ({ mapId, config }) => {
				await runMutation(UpdateMapConfigDocument, { mapId, config });
				return { success: true as const };
			},
		),
	},
	chartPlugin: {
		list: query<void, Outputs['chartPlugin']['list']>(
			['chartPlugin', 'list'],
			async () => (await runQuery(ChartPluginsDocument, {})).chartPlugins as Outputs['chartPlugin']['list'],
		),
		source: query<Inputs['chartPlugin']['source'], Outputs['chartPlugin']['source']>(
			['chartPlugin', 'source'],
			async ({ type, version }) =>
				(await runQuery(ChartPluginSourceDocument, { type, version })).chartPluginSource,
		),
	},
};
