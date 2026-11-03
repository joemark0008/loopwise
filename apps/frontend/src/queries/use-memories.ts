import { useMutation, useQuery } from '@tanstack/react-query';
import { memoryApi } from '@/lib/memory-api';

export function useMemorySettingsQuery() {
	return useQuery(memoryApi.user.getMemorySettings.queryOptions());
}

export function useMemoriesQuery(enabled: boolean) {
	return useQuery({
		...memoryApi.user.getMemories.queryOptions(),
		enabled,
		staleTime: 5 * 1000,
	});
}

export function useMemoryMutations() {
	const updateMemorySettingsMutation = useMutation(
		memoryApi.memory.setEnabled.mutationOptions({
			onSuccess: (data, _, __, ctx) => {
				ctx.client.setQueryData(memoryApi.user.getMemorySettings.queryKey(), data);
			},
		}),
	);

	const updateMutation = useMutation(
		memoryApi.memory.edit.mutationOptions({
			onSuccess: (updated, _, __, ctx) => {
				ctx.client.setQueryData(memoryApi.user.getMemories.queryKey(), (prev = []) =>
					prev.map((memory) => (memory.id === updated.id ? updated : memory)),
				);
			},
		}),
	);

	const deleteMutation = useMutation(
		memoryApi.memory.delete.mutationOptions({
			onSuccess: (_, variables, __, ctx) => {
				ctx.client.setQueryData(memoryApi.user.getMemories.queryKey(), (prev = []) =>
					prev.filter((memory) => memory.id !== variables.memoryId),
				);
			},
		}),
	);

	return { updateMemorySettingsMutation, updateMutation, deleteMutation };
}
