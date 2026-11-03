import { createFileRoute } from '@tanstack/react-router';
import { ProjectSettingsPage } from '@/feature/settings/project-page';

export const Route = createFileRoute('/_protected/settings/project/')({
	staticData: {
		title: 'Project Settings',
	},
	component: ProjectSettingsPage,
});
