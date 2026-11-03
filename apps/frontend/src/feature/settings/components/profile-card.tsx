import { LogOut, Pen } from 'lucide-react';
import styles from './profile-card.module.css';
import { SettingsCard } from '@/components/ui/settings-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

interface UserProfileCardProps {
	name?: string;
	email?: string;
	onEdit: () => void;
	onSignOut: () => void;
}

export function UserProfileCard({ name, email, onEdit, onSignOut }: UserProfileCardProps) {
	return (
		<SettingsCard className={styles.userProfileCardSettingsCard}>
			<div className={styles.userProfileCardDiv}>
				{name && <Avatar username={name} size='xl' />}
				<div className={styles.userProfileCardDiv2}>
					<h2 className={styles.userProfileCardH2}>{name}</h2>
					<p className={styles.userProfileCardP}>{email}</p>
				</div>
			</div>

			<div className={styles.userProfileCardDiv3}>
				<Button variant='secondary' size='sm' onClick={onEdit}>
					<Pen />
					Edit
				</Button>
				<Button variant='destructive-soft' size='sm' onClick={onSignOut}>
					<LogOut />
					Sign out
				</Button>
			</div>
		</SettingsCard>
	);
}
