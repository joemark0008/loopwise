import { Outlet, useMatches } from '@tanstack/react-router';
import styles from './clinic-layout.module.css';
import { SettingsCard, SettingsPageWrapper } from '@/components/ui/settings-card';
import { Empty } from '@/components/ui/empty';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

declare module '@tanstack/react-router' {
	interface StaticDataRouteOption {
		title?: string;
		description?: string;
	}
}

export function ClinicPage() {
	const clinic = useCurrentClinic();
	const lastMatch = useMatches().at(-1);
	const pageHeader = lastMatch?.staticData;
	// The query workbench takes the whole page and has its own header.
	const isFullPage = Boolean((lastMatch?.search as { tool?: string } | undefined)?.tool);
	const emptyMessage = 'No clinic selected. Create one with New clinic in the clinic switcher.';

	return (
		<SettingsPageWrapper full={isFullPage}>
			<div className={styles.clinicPageDiv}>
				{pageHeader?.title && !isFullPage && (
					<div>
						<h1 className={styles.clinicPageH1}>{pageHeader.title}</h1>
						{pageHeader.description && <p className={styles.clinicPageP}>{pageHeader.description}</p>}
					</div>
				)}
				<div className={styles.clinicPageDiv2}>
					{clinic.data ? (
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
