import { useState } from 'react';
import styles from './clinic-page.module.css';
import { DeleteClinicDialog } from '@/feature/settings/components/delete-clinic-dialog';
import { EditableClinicName } from '@/feature/settings/components/editable-clinic-name';
import { ClinicIdentifier } from '@/feature/settings/components/clinic-identifier';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useCurrentClinic } from '@/hooks/use-current-clinic';

export function ClinicSettingsPage() {
	const clinic = useCurrentClinic();
	const { isAdmin } = usePermissions();
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);

	return (
		<>
			<SettingsCard title='Information'>
				{clinic.isLoading ? (
					<>
						<DetailRow label='Name' value={<Skeleton className={styles.clinicSettingsPageSkeleton} />} />
						<DetailRow label='Path' value={<Skeleton className={styles.clinicSettingsPageSkeleton2} />} />
						<DetailRow
							label='Clinic ID'
							value={<Skeleton className={styles.clinicSettingsPageSkeleton3} />}
						/>
					</>
				) : clinic.data ? (
					<>
						<DetailRow
							label='Name'
							value={
								<EditableClinicName
									key={clinic.data.id}
									clinicId={clinic.data.id}
									name={clinic.data.name}
									canEdit={isAdmin}
								/>
							}
						/>
						{clinic.data.path && (
							<DetailRow
								label='Path'
								value={<code className={styles.clinicSettingsPageCode}>{clinic.data.path}</code>}
							/>
						)}
						<DetailRow label='Clinic ID' value={<ClinicIdentifier clinicId={clinic.data.id} />} />
					</>
				) : null}
			</SettingsCard>
			{isAdmin && clinic.data && (
				<SettingsCard title='Danger zone'>
					<div className={styles.detailRowDiv}>
						<span className={styles.dangerZoneSpan}>
							Permanently delete this clinic, its chats and its settings.
						</span>
						<Button variant='destructive' size='sm' onClick={() => setIsDeleteOpen(true)}>
							Delete clinic
						</Button>
					</div>
					<DeleteClinicDialog
						open={isDeleteOpen}
						onOpenChange={setIsDeleteOpen}
						clinicId={clinic.data.id}
						clinicName={clinic.data.name}
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
