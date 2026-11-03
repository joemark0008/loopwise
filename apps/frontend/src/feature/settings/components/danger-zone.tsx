import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import styles from './danger-zone.module.css';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { SettingsCard } from '@/components/ui/settings-card';
import { chatApi } from '@/lib/chat-api';

export function DangerZone() {
	const [isOpen, setIsOpen] = useState(false);
	const navigate = useNavigate();

	const deleteAllNonStarred = useMutation(
		chatApi.chat.deleteAllNonStarred.mutationOptions({
			onSuccess: (_data, _, __, ctx) => {
				ctx.client.invalidateQueries({ queryKey: [['chat', 'listGrouped']] });
				setIsOpen(false);
				navigate({ to: '/' });
			},
		}),
	);

	return (
		<>
			<SettingsCard title='Danger Zone'>
				<div className={styles.dangerZoneDiv}>
					<div className={styles.dangerZoneDiv2}>
						<p className={styles.dangerZoneP}>Delete all chats</p>
						<p className={styles.dangerZoneP2}>
							Permanently delete all your non-starred conversations and the stories created in them.
							Starred chats and their stories will be kept.
						</p>
					</div>
					<Button variant='destructive' size='sm' onClick={() => setIsOpen(true)}>
						Delete all
					</Button>
				</div>
			</SettingsCard>

			<AlertDialog open={isOpen} onOpenChange={setIsOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete all non-starred chats?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete all your conversations that are not starred. Any stories
							created in them will be deleted too, including for people they are shared with. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant='destructive'
							isLoading={deleteAllNonStarred.isPending}
							onClick={(e) => {
								e.preventDefault();
								deleteAllNonStarred.mutate();
							}}
						>
							Delete all
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
