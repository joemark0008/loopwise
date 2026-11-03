import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	DeleteMemoryDocument,
	EditMemoryDocument,
	MemoriesDocument,
	MemorySettingsDocument,
	ProjectMemorySettingsDocument,
	SetMemoryEnabledDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs;
type Outputs = ApiOutputs;
type Memory = Outputs['user']['getMemories'][number];

/**
 * Memory settings moved to apps/api (`lib/apollo-procedures.ts`): call sites swap upstream tRPC's `memory.*`,
 * `user.getMemories` / `getMemorySettings` and `project.getMemorySettings` for `memoryApi.*`.
 */
export const memoryApi = {
	user: {
		getMemories: query<void, Outputs['user']['getMemories']>(['user', 'getMemories'], async () =>
			(await runQuery(MemoriesDocument, {})).memories.map(toMemory),
		),
		getMemorySettings: query<void, Outputs['user']['getMemorySettings']>(
			['user', 'getMemorySettings'],
			async () => (await runQuery(MemorySettingsDocument, {})).memorySettings,
		),
	},
	project: {
		getMemorySettings: query<void, Outputs['project']['getMemorySettings']>(
			['project', 'getMemorySettings'],
			async () => (await runQuery(ProjectMemorySettingsDocument, {})).projectMemorySettings,
		),
	},
	memory: {
		setEnabled: mutation<Inputs['memory']['setEnabled'], Outputs['memory']['setEnabled']>(
			['memory', 'setEnabled'],
			async ({ memoryEnabled }) =>
				(await runMutation(SetMemoryEnabledDocument, { memoryEnabled })).setMemoryEnabled,
		),
		edit: mutation<Inputs['memory']['edit'], Outputs['memory']['edit']>(['memory', 'edit'], async (input) =>
			toMemory((await runMutation(EditMemoryDocument, { input })).editMemory),
		),
		delete: mutation<Inputs['memory']['delete'], void>(['memory', 'delete'], async ({ memoryId }) => {
			await runMutation(DeleteMemoryDocument, { memoryId });
		}),
	},
};

function toMemory(memory: { createdAt: string; updatedAt: string; category: string }): Memory {
	return {
		...memory,
		category: memory.category as Memory['category'],
		createdAt: new Date(memory.createdAt),
		updatedAt: new Date(memory.updatedAt),
	} as Memory;
}
