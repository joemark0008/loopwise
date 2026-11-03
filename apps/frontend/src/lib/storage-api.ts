import type { ApiOutputs } from '@/lib/api-types';

import {
	StorageConfigDocument,
	StorageHealthDocument,
	StorageUploadLimitsDocument,
	StorageUsageDocument,
} from '@/graphql/generated/graphql';
import { query, runQuery } from '@/lib/apollo-procedures';

type Outputs = ApiOutputs['storage'];

/**
 * Permanent storage moved to apps/api (`lib/apollo-procedures.ts`): call sites swap upstream tRPC's `storage.*` for
 * `storageApi.storage.*`. The payloads are JSON in upstream's shapes.
 */
export const storageApi = {
	storage: {
		getConfig: query<void, Outputs['getConfig']>(
			['storage', 'getConfig'],
			async () => (await runQuery(StorageConfigDocument, {})).storageConfig as Outputs['getConfig'],
		),
		getHealth: query<void, Outputs['getHealth']>(['storage', 'getHealth'], async () => {
			const health = (await runQuery(StorageHealthDocument, {})).storageHealth as Outputs['getHealth'];
			return { ...health, checkedAt: new Date(health.checkedAt) };
		}),
		getUploadLimits: query<void, Outputs['getUploadLimits']>(
			['storage', 'getUploadLimits'],
			async () =>
				(await runQuery(StorageUploadLimitsDocument, {})).storageUploadLimits as Outputs['getUploadLimits'],
		),
		getUsage: query<void, Outputs['getUsage']>(
			['storage', 'getUsage'],
			async () => (await runQuery(StorageUsageDocument, {})).storageUsage as Outputs['getUsage'],
		),
	},
};
