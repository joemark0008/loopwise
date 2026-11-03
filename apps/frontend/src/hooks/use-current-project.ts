import { useQuery } from '@apollo/client/react';
import type { UserRole } from '@loopwise/shared/types';

import type { ProjectSummaryFieldsFragment } from '@/graphql/generated/graphql';
import { CurrentProjectDocument, ProjectsDocument } from '@/graphql/generated/graphql';
import { apolloClient } from '@/lib/apollo-client';

export type ProjectSummary = Omit<ProjectSummaryFieldsFragment, 'userRole' | '__typename'> & { userRole: UserRole };

const toProject = (project: ProjectSummaryFieldsFragment): ProjectSummary => ({
	...project,
	userRole: project.userRole as UserRole,
});

/** The selected project from apps/api (`currentProject`), shaped like upstream's `project.getCurrent`. */
export function useCurrentProject({ skip = false }: { skip?: boolean } = {}) {
	const { data, loading, error, refetch } = useQuery(CurrentProjectDocument, { skip });
	const project = data ? (data.currentProject ? toProject(data.currentProject) : null) : undefined;
	return {
		data: project,
		isLoading: loading && !data,
		isPending: !data,
		isFetching: loading,
		isSuccess: data !== undefined,
		isError: error !== undefined,
		error,
		refetch,
	};
}

/** Projects the user can access (`projects`), shaped like upstream's `project.listForCurrentUser`. */
export function useProjects({ skip = false }: { skip?: boolean } = {}) {
	const { data, loading, error, refetch } = useQuery(ProjectsDocument, { skip });
	return {
		data: data?.projects.map(toProject),
		isLoading: loading && !data,
		isPending: !data,
		isFetching: loading,
		isSuccess: data !== undefined,
		isError: error !== undefined,
		error,
		refetch,
	};
}

/** Outside React (route loaders): the selected project, from the Apollo cache when present. */
export async function fetchCurrentProject(): Promise<ProjectSummary | null> {
	const { data } = await apolloClient.query({ query: CurrentProjectDocument });
	return data?.currentProject ? toProject(data.currentProject) : null;
}

/** Re-reads the project queries after a project is created, renamed, deleted or switched. */
export async function refetchProjectQueries(): Promise<void> {
	await apolloClient.refetchQueries({ include: [CurrentProjectDocument, ProjectsDocument] });
}
