import { useMutation, useQuery } from '@tanstack/react-query';
import type { SavedPrompt } from '@/lib/api-types';
import { useCurrentClinic } from '@/hooks/use-current-clinic';
import { clinicApi } from '@/lib/clinic-api';

/** Saved prompts of `clinicId`, or of the current clinic when it is omitted. */
export function useSavedPromptsQuery(clinicId?: string) {
	const clinic = useCurrentClinic();
	const savedPromptsQuery = useQuery({
		...clinicApi.clinic.getSavedPrompts.queryOptions(),
		enabled: !clinicId && (clinic.isError || clinic.data != null),
	});
	const clinicSavedPromptsQuery = useQuery({
		...clinicApi.clinic.getClinicSavedPrompts.queryOptions({ clinicId: clinicId ?? '' }),
		enabled: !!clinicId,
	});
	if (clinicId) {
		return clinicSavedPromptsQuery;
	}
	return {
		...savedPromptsQuery,
		data: clinic.data === null ? undefined : savedPromptsQuery.data,
		isLoading: clinic.isPending || savedPromptsQuery.isLoading,
	};
}

/** CRUD mutations for saved prompts */
export function useSavedPromptMutations() {
	const createMutation = useMutation(
		clinicApi.clinic.createSavedPrompt.mutationOptions({
			onSuccess: (newPrompt, _, __, ctx) => {
				ctx.client.setQueryData(clinicApi.clinic.getSavedPrompts.queryKey(), (prev: SavedPrompt[] = []) => [
					...prev,
					newPrompt,
				]);
			},
		}),
	);

	const updateMutation = useMutation(
		clinicApi.clinic.updateSavedPrompt.mutationOptions({
			onSuccess: (updatedPrompt, _, __, ctx) => {
				ctx.client.setQueryData(clinicApi.clinic.getSavedPrompts.queryKey(), (prev: SavedPrompt[] = []) =>
					prev.map((p) => (p.id === updatedPrompt.id ? updatedPrompt : p)),
				);
			},
		}),
	);

	const deleteMutation = useMutation(
		clinicApi.clinic.deleteSavedPrompt.mutationOptions({
			onSuccess: (_, variables, __, ctx) => {
				ctx.client.setQueryData(clinicApi.clinic.getSavedPrompts.queryKey(), (prev: SavedPrompt[] = []) =>
					prev.filter((p) => p.id !== variables.promptId),
				);
			},
		}),
	);

	return { createMutation, updateMutation, deleteMutation };
}
