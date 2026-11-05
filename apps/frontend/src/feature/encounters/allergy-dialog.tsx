import { ALLERGY_SEVERITIES, ALLERGY_TYPES } from '@loopwise/shared/encounter-record';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './encounter.module.css';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import type { AllergyType, Severity } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { encounterRecordApi } from '@/lib/encounter-record-api';

/** Records an allergy of the patient (not only of this visit); new prescriptions are checked against it. */
export function AllergyDialog({
	patientId,
	open,
	onOpenChange,
}: {
	patientId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [allergen, setAllergen] = useState('');
	const [reaction, setReaction] = useState('');
	const [type, setType] = useState<AllergyType>('DRUG');
	const [severity, setSeverity] = useState<Severity | ''>('');
	const add = useRecordMutation(encounterRecordApi.encounterRecord.addAllergy);
	const queryClient = useQueryClient();

	const close = (next: boolean) => {
		if (!next) {
			setAllergen('');
			setReaction('');
			setType('DRUG');
			setSeverity('');
			add.reset();
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				<form
					className={styles.section}
					onSubmit={(event) => {
						event.preventDefault();
						add.mutate(
							{
								patientId,
								allergen,
								reaction: reaction || null,
								type,
								severity: severity || null,
							},
							{
								onSuccess: () => {
									// The patient banner's allergies.
									void queryClient.invalidateQueries(
										encounterRecordApi.encounterRecord.allergies.pathFilter(),
									);
									close(false);
								},
							},
						);
					}}
				>
					<DialogHeader>
						<DialogTitle>Add allergy</DialogTitle>
						<DialogDescription>Prescriptions with a matching medicine get a warning.</DialogDescription>
					</DialogHeader>
					<div className={styles.fields}>
						<FormField label='Allergen' wide>
							{(id) => (
								<Input
									id={id}
									value={allergen}
									placeholder='Penicillin'
									onChange={(event) => setAllergen(event.target.value)}
								/>
							)}
						</FormField>
						<FormField label='Type'>
							{() => (
								<Select value={type} onValueChange={(value) => setType(value as AllergyType)}>
									<SelectTrigger className={styles.control} aria-label='Type'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ALLERGY_TYPES.map((option) => (
											<SelectItem key={option} value={option}>
												{sentenceCase(option)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</FormField>
						<FormField label='Severity'>
							{() => (
								<Select value={severity} onValueChange={(value) => setSeverity(value as Severity)}>
									<SelectTrigger className={styles.control} aria-label='Severity'>
										<SelectValue placeholder='Not known' />
									</SelectTrigger>
									<SelectContent>
										{ALLERGY_SEVERITIES.map((option) => (
											<SelectItem key={option} value={option}>
												{sentenceCase(option)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</FormField>
						<FormField label='Reaction' wide>
							{(id) => (
								<Input
									id={id}
									value={reaction}
									placeholder='Rash, swelling'
									onChange={(event) => setReaction(event.target.value)}
								/>
							)}
						</FormField>
					</div>
					{add.error && <ErrorMessage message={add.error.message} />}
					<DialogFooter>
						<Button type='button' variant='ghost-muted' onClick={() => close(false)}>
							Cancel
						</Button>
						<Button type='submit' disabled={!allergen.trim() || add.isPending}>
							Add allergy
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** `ENVIRONMENTAL` → `Environmental`. */
const sentenceCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
