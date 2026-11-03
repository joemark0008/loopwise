import { useMutation, useQuery } from '@tanstack/react-query';
import type { SavedPrompt } from '@/lib/api-types';
import { useCurrentProject } from '@/hooks/use-current-project';
import { projectApi } from '@/lib/project-api';

/** Saved prompts of `projectId`, or of the current project when it is omitted. */
export function useSavedPromptsQuery(projectId?: string) {
	const project = useCurrentProject();
	const savedPromptsQuery = useQuery({
		...projectApi.project.getSavedPrompts.queryOptions(),
		enabled: !projectId && (project.isError || project.data != null),
	});
	const projectSavedPromptsQuery = useQuery({
		...projectApi.project.getProjectSavedPrompts.queryOptions({ projectId: projectId ?? '' }),
		enabled: !!projectId,
	});
	if (projectId) {
		return projectSavedPromptsQuery;
	}
	return {
		...savedPromptsQuery,
		data: project.data === null ? undefined : savedPromptsQuery.data,
		isLoading: project.isPending || savedPromptsQuery.isLoading,
	};
}

/** CRUD mutations for saved prompts */
export function useSavedPromptMutations() {
	const createMutation = useMutation(
		projectApi.project.createSavedPrompt.mutationOptions({
			onSuccess: (newPrompt, _, __, ctx) => {
				ctx.client.setQueryData(projectApi.project.getSavedPrompts.queryKey(), (prev: SavedPrompt[] = []) => [
					...prev,
					newPrompt,
				]);
			},
		}),
	);

	const updateMutation = useMutation(
		projectApi.project.updateSavedPrompt.mutationOptions({
			onSuccess: (updatedPrompt, _, __, ctx) => {
				ctx.client.setQueryData(projectApi.project.getSavedPrompts.queryKey(), (prev: SavedPrompt[] = []) =>
					prev.map((p) => (p.id === updatedPrompt.id ? updatedPrompt : p)),
				);
			},
		}),
	);

	const deleteMutation = useMutation(
		projectApi.project.deleteSavedPrompt.mutationOptions({
			onSuccess: (_, variables, __, ctx) => {
				ctx.client.setQueryData(projectApi.project.getSavedPrompts.queryKey(), (prev: SavedPrompt[] = []) =>
					prev.filter((p) => p.id !== variables.promptId),
				);
			},
		}),
	);

	return { createMutation, updateMutation, deleteMutation };
}
