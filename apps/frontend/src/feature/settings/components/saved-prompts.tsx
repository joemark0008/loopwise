import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { SavedPromptItem, SavedPromptSkeleton } from './saved-prompt';
import styles from './saved-prompts.module.css';
import type { SavedPrompt } from '@/lib/api-types';
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogCancel,
	AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogTitle, DialogHeader, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { NakedInput } from '@/components/ui/input';
import { ErrorMessage } from '@/components/ui/error-message';
import { SettingsCard } from '@/components/ui/settings-card';
import { Empty } from '@/components/ui/empty';
import { useSavedPromptsQuery, useSavedPromptMutations } from '@/hooks/use-saved-prompts';
import { Button } from '@/components/ui/button';

interface SavedPromptsSectionProps {
	isAdmin: boolean;
}

export function SavedPrompts({ isAdmin }: SavedPromptsSectionProps) {
	const [showDialogPrompt, setShowDialogPrompt] = useState(false);
	const [dialogPrompt, setDialogPrompt] = useState<SavedPrompt>(); // Current prompt being edited or created
	const [showDeleteAlert, setShowDeleteAlert] = useState(false);
	const [promptToDelete, setPromptToDelete] = useState<{ id: string; title: string }>();
	const { data: savedPrompts = [], isLoading } = useSavedPromptsQuery();
	const { createMutation, updateMutation, deleteMutation } = useSavedPromptMutations();

	const handleNewPrompt = () => {
		setDialogPrompt({
			id: '',
			title: '',
			prompt: '',
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		setShowDialogPrompt(true);
	};

	const handleSavePrompt = async (data: { title: string; prompt: string }) => {
		if (!dialogPrompt) {
			return;
		}

		updateMutation.reset();
		createMutation.reset();

		if (dialogPrompt.id) {
			// Update existing prompt
			await updateMutation.mutateAsync({
				id: dialogPrompt.id,
				title: data.title,
				prompt: data.prompt,
			});
		} else {
			// Create new prompt
			await createMutation.mutateAsync({
				title: data.title,
				prompt: data.prompt,
			});
		}

		setDialogPrompt(undefined);
	};

	const handleEditPrompt = (id: string) => {
		setDialogPrompt(savedPrompts.find((prompt) => prompt.id === id));
		setShowDialogPrompt(true);
	};

	const handleDeletePrompt = (id: string) => {
		setPromptToDelete({ id, title: savedPrompts.find((prompt) => prompt.id === id)?.title || '' });
		setShowDeleteAlert(true);
	};

	const handleDeleteAlertAction = () => {
		if (promptToDelete) {
			deleteMutation.mutate({ promptId: promptToDelete.id });
		}
	};

	return (
		<>
			<SettingsCard
				title='Saved Prompts'
				description='Save repeatable, customizable prompts for the agent to follow.'
				action={
					isAdmin && (
						<Button
							variant='secondary'
							size='sm'
							className={styles.savedPromptsButton}
							onClick={handleNewPrompt}
						>
							<Plus className={styles.savedPromptsPlus} />
							New Prompt
						</Button>
					)
				}
				divide
			>
				{isLoading ? (
					<>
						<SavedPromptSkeleton className={styles.savedPromptsSavedPromptSkeleton} />
						<SavedPromptSkeleton />
						<SavedPromptSkeleton className={styles.savedPromptsSavedPromptSkeleton2} />
					</>
				) : savedPrompts.length === 0 ? (
					<Empty>No saved prompts yet.</Empty>
				) : (
					<>
						{savedPrompts.map((prompt) => (
							<SavedPromptItem
								key={prompt.id}
								prompt={prompt}
								className={styles.savedPromptsSavedPromptItem}
								onEdit={handleEditPrompt}
								onDelete={handleDeletePrompt}
							/>
						))}
					</>
				)}
			</SettingsCard>

			{dialogPrompt && (
				<PromptDialog
					open={showDialogPrompt}
					prompt={dialogPrompt}
					onClose={() => setShowDialogPrompt(false)}
					onSave={handleSavePrompt}
					error={createMutation.error?.message || updateMutation.error?.message}
				/>
			)}

			{promptToDelete && (
				<DeletePromptDialog
					open={showDeleteAlert}
					promptToDelete={promptToDelete}
					onOpenChange={setShowDeleteAlert}
					onDelete={handleDeleteAlertAction}
					isLoading={deleteMutation.isPending}
					error={deleteMutation.error?.message}
				/>
			)}
		</>
	);
}

const PromptDialog = ({
	prompt,
	onClose,
	onSave,
	open,
	error,
}: {
	prompt: SavedPrompt;
	onClose: () => void;
	onSave: (data: { title: string; prompt: string }) => Promise<void>;
	open: boolean;
	error?: string;
}) => {
	const form = useForm({
		defaultValues: {
			title: prompt.title,
			prompt: prompt.prompt,
		},
		validators: {
			onChange: ({ value }) => ({
				fields: {
					title: !value.title.trim()
						? 'Title is required'
						: value.title.length < 3
							? 'Title must be at least 3 characters long'
							: undefined,
					prompt: !value.prompt.trim()
						? 'Prompt is required'
						: value.prompt.length < 10
							? 'Prompt must be at least 10 characters long'
							: undefined,
				},
			}),
		},
		onSubmit: async ({ value }) => {
			await onSave(value);
		},
	});

	useEffect(() => {
		form.reset();
	}, [prompt, form]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		form.handleSubmit();
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className={styles.promptDialogDialogContent} showCloseButton={false}>
				<form
					onSubmit={handleSubmit}
					className={styles.promptDialogForm}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && e.metaKey) {
							handleSubmit(e);
						}
					}}
				>
					<DialogHeader className={styles.promptDialogDialogHeader}>
						<DialogTitle className={styles.promptDialogDialogTitle}>
							<form.Field name='title'>
								{(field) => (
									<NakedInput
										autoFocus={true}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder='Prompt title (used for UI display)'
										className={styles.promptDialogNakedInput}
									/>
								)}
							</form.Field>
						</DialogTitle>
					</DialogHeader>

					<form.Field name='prompt'>
						{(field) => (
							<Textarea
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder='Describe what the agent should do...'
								className={styles.promptDialogTextarea}
								rows={5}
							/>
						)}
					</form.Field>

					{error && <ErrorMessage message={error} />}

					<form.Subscribe selector={(state) => [state.canSubmit, state.isDefaultValue, state.isSubmitting]}>
						{([canSubmit, isDefaultValue, isSubmitting]) => (
							<DialogFooter>
								<Button
									type='button'
									variant='ghost-muted'
									size='sm'
									onClick={onClose}
									disabled={isSubmitting}
								>
									Cancel
								</Button>

								<Button
									type='submit'
									variant='primary-gradient'
									size='sm'
									disabled={!canSubmit || isDefaultValue || isSubmitting}
									isLoading={isSubmitting}
								>
									Save
								</Button>
							</DialogFooter>
						)}
					</form.Subscribe>
				</form>
			</DialogContent>
		</Dialog>
	);
};

const DeletePromptDialog = ({
	open,
	promptToDelete,
	onOpenChange,
	onDelete,
	isLoading,
	error,
}: {
	open: boolean;
	promptToDelete: { id: string; title: string };
	onOpenChange: (open: boolean) => void;
	onDelete: () => void;
	isLoading: boolean;
	error?: string;
}) => {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent size='sm' closeOnOutsideClick onCloseOnOutsideClick={() => onOpenChange(false)}>
				<AlertDialogHeader className={styles.deletePromptDialogAlertDialogHeader}>
					<AlertDialogTitle className='text-md'>Delete "{promptToDelete?.title}"?</AlertDialogTitle>
					<AlertDialogDescription>This will be permanently deleted.</AlertDialogDescription>
					{error && <ErrorMessage message={error} />}
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel variant='outline' size='sm'>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction variant='destructive' size='sm' onClick={onDelete} isLoading={isLoading}>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
