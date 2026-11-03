import { useState } from 'react';
import styles from './project-page.module.css';
import { DeleteProjectDialog } from '@/feature/settings/components/delete-project-dialog';
import { EditableProjectName } from '@/feature/settings/components/editable-project-name';
import { ProjectIdentifier } from '@/feature/settings/components/project-identifier';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useCurrentProject } from '@/hooks/use-current-project';

export function ProjectSettingsPage() {
	const project = useCurrentProject();
	const { isAdmin } = usePermissions();
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);

	return (
		<>
			<SettingsCard title='Information'>
				{project.isLoading ? (
					<>
						<DetailRow label='Name' value={<Skeleton className={styles.projectSettingsPageSkeleton} />} />
						<DetailRow label='Path' value={<Skeleton className={styles.projectSettingsPageSkeleton2} />} />
						<DetailRow
							label='Project ID'
							value={<Skeleton className={styles.projectSettingsPageSkeleton3} />}
						/>
					</>
				) : project.data ? (
					<>
						<DetailRow
							label='Name'
							value={
								<EditableProjectName
									key={project.data.id}
									projectId={project.data.id}
									name={project.data.name}
									canEdit={isAdmin}
								/>
							}
						/>
						{project.data.path && (
							<DetailRow
								label='Path'
								value={<code className={styles.projectSettingsPageCode}>{project.data.path}</code>}
							/>
						)}
						<DetailRow label='Project ID' value={<ProjectIdentifier projectId={project.data.id} />} />
					</>
				) : null}
			</SettingsCard>
			{isAdmin && project.data && (
				<SettingsCard title='Danger zone'>
					<div className={styles.detailRowDiv}>
						<span className={styles.dangerZoneSpan}>
							Permanently delete this project, its chats and its settings.
						</span>
						<Button variant='destructive' size='sm' onClick={() => setIsDeleteOpen(true)}>
							Delete project
						</Button>
					</div>
					<DeleteProjectDialog
						open={isDeleteOpen}
						onOpenChange={setIsDeleteOpen}
						projectId={project.data.id}
						projectName={project.data.name}
					/>
				</SettingsCard>
			)}
		</>
	);
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className={styles.detailRowDiv}>
			<span className={styles.detailRowSpan}>{label}</span>
			<div className={styles.detailRowDiv2}>{value}</div>
		</div>
	);
}
