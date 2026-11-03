import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import styles from './account-page.module.css';
import { EditProfileDialog } from '@/feature/settings/components/edit-profile-dialog';
import { ChangePasswordDialog } from '@/feature/settings/components/change-password-dialog';
import { ClinicianProfileCard } from '@/feature/settings/components/clinician-profile-card';
import { Button } from '@/components/ui/button';
import { UpdateProfileDocument } from '@/graphql/generated/graphql';
import { useSession } from '@/lib/auth-client';
import { useSignOut } from '@/hooks/use-sign-out';
import { SettingsVersionInfo } from '@/feature/settings/components/version-info';
import { usePermissions } from '@/hooks/use-permissions';
import { UserProfileCard } from '@/feature/settings/components/profile-card';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { soundNotificationStorage } from '@/hooks/use-stream-end-sound';
import { useToolCallDensity } from '@/hooks/use-tool-call-density';
import { ThemeSelector } from '@/feature/settings/components/theme-selector';
import { ToolCallDensitySetting } from '@/feature/settings/components/tool-call-density-setting';
import { DangerZone } from '@/feature/settings/components/danger-zone';
import { SettingsMemories } from '@/feature/settings/components/memories';
import { SettingsCard, SettingsPageWrapper } from '@/components/ui/settings-card';
import { SettingsControlRow, SettingsToggleRow } from '@/components/ui/settings-toggle-row';
import { refetchProjectQueries } from '@/hooks/use-current-project';

export function GeneralPage() {
	const { data: session, refetch } = useSession();
	const user = session?.user;
	const { isAdmin, isViewer } = usePermissions();
	const [soundEnabled, setSoundEnabled] = useLocalStorage(soundNotificationStorage);
	const [toolCallDensity, setToolCallDensity, toolCallDensityState] = useToolCallDensity();

	const [editOpen, setEditOpen] = useState(false);
	const [passwordOpen, setPasswordOpen] = useState(false);
	const [passwordChanged, setPasswordChanged] = useState(false);

	const [updateProfile] = useMutation(UpdateProfileDocument);

	const handleEdit = async (name: string) => {
		await updateProfile({ variables: { input: { name } } });
		await refetchProjectQueries();
		await refetch();
	};

	const handleSignOut = useSignOut();

	return (
		<SettingsPageWrapper>
			<div className={styles.generalPageDiv}>
				<div>
					<h1 className={styles.generalPageH1}>Account</h1>
					<p className={styles.generalPageP}>Manage your account and session.</p>
				</div>
				<div className={styles.generalPageDiv2}>
					<UserProfileCard
						name={user?.name}
						email={user?.email}
						onEdit={() => setEditOpen(true)}
						onSignOut={handleSignOut}
					/>

					<EditProfileDialog
						open={editOpen}
						onOpenChange={setEditOpen}
						name={user?.name}
						onSubmit={handleEdit}
					/>

					<ClinicianProfileCard />

					<SettingsCard title='Security' divide>
						<SettingsControlRow
							label='Password'
							description={
								passwordChanged
									? 'Password changed. Your other sessions were signed out.'
									: 'Change the password you log in with. Forgot it? Ask an admin for a reset link.'
							}
							control={
								<Button
									size='sm'
									variant='outline'
									onClick={() => {
										setPasswordChanged(false);
										setPasswordOpen(true);
									}}
								>
									Change password
								</Button>
							}
						/>
					</SettingsCard>

					<ChangePasswordDialog
						open={passwordOpen}
						onOpenChange={setPasswordOpen}
						onChanged={() => setPasswordChanged(true)}
					/>

					<SettingsCard title='General Settings' divide>
						<SettingsToggleRow
							id='sound-notification'
							label='Sound notification'
							description='Play a sound when the agent finishes responding.'
							checked={soundEnabled}
							onCheckedChange={setSoundEnabled}
						/>
						<ToolCallDensitySetting
							value={toolCallDensity}
							onValueChange={setToolCallDensity}
							canChange={toolCallDensityState.canChange}
							isLoading={toolCallDensityState.isLoading}
						/>
						<SettingsControlRow
							label='Theme'
							description='Choose how Loopwise looks.'
							control={<ThemeSelector />}
						/>
					</SettingsCard>

					<SettingsMemories isAdmin={isAdmin} />

					{!isViewer && <DangerZone />}
				</div>
			</div>
			{isAdmin && <SettingsVersionInfo />}
		</SettingsPageWrapper>
	);
}
