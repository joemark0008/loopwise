import { Outlet, useMatches } from '@tanstack/react-router';
import styles from './project-layout.module.css';
import { SettingsCard, SettingsPageWrapper } from '@/components/ui/settings-card';
import { Empty } from '@/components/ui/empty';
import { useCurrentProject } from '@/hooks/use-current-project';

declare module '@tanstack/react-router' {
	interface StaticDataRouteOption {
		title?: string;
		description?: string;
	}
}

export function ProjectPage() {
	const project = useCurrentProject();
	const lastMatch = useMatches().at(-1);
	const pageHeader = lastMatch?.staticData;
	// The query workbench takes the whole page and has its own header.
	const isFullPage = Boolean((lastMatch?.search as { tool?: string } | undefined)?.tool);
	const emptyMessage = 'No project selected. Create one with New project in the project switcher.';

	return (
		<SettingsPageWrapper full={isFullPage}>
			<div className={styles.projectPageDiv}>
				{pageHeader?.title && !isFullPage && (
					<div>
						<h1 className={styles.projectPageH1}>{pageHeader.title}</h1>
						{pageHeader.description && <p className={styles.projectPageP}>{pageHeader.description}</p>}
					</div>
				)}
				<div className={styles.projectPageDiv2}>
					{project.data ? (
						<Outlet />
					) : (
						<SettingsCard>
							<Empty>{emptyMessage}</Empty>
						</SettingsCard>
					)}
				</div>
			</div>
		</SettingsPageWrapper>
	);
}
