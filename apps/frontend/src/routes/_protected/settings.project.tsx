import { createFileRoute, redirect } from '@tanstack/react-router';
import { fetchCurrentProject } from '@/hooks/use-current-project';
import { ProjectPage } from '@/feature/settings/project-layout';

export const Route = createFileRoute('/_protected/settings/project')({
	beforeLoad: async () => {
		const project = await fetchCurrentProject();
		if (project?.userRole === 'viewer') {
			throw redirect({ to: '/settings/account' });
		}
	},
	component: ProjectPage,
});
