import { ALLERGY_KINDS, ALLERGY_SEVERITIES } from '@loopwise/shared/encounter-record';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './encounter.module.css';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import type { AllergyKind, AllergySeverity } from '@/graphql/generated/graphql';
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
	facilityId,
	open,
	onOpenChange,
}: {
	patientId: string;
	facilityId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [substance, setSubstance] = useState('');
	const [reaction, setReaction] = useState('');
	const [kind, setKind] = useState<AllergyKind>('drug');
	const [severity, setSeverity] = useState<AllergySeverity | ''>('');
	const add = useRecordMutation(encounterRecordApi.encounterRecord.addAllergy);
	const queryClient = useQueryClient();

	const close = (next: boolean) => {
		if (!next) {
			setSubstance('');
			setReaction('');
			setKind('drug');
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
								facilityId,
								substance,
								reaction: reaction || null,
								kind,
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
						<FormField label='Substance' wide>
							{(id) => (
								<Input
									id={id}
									value={substance}
									placeholder='Penicillin'
									onChange={(event) => setSubstance(event.target.value)}
								/>
							)}
						</FormField>
						<FormField label='Kind'>
							{() => (
								<Select value={kind} onValueChange={(value) => setKind(value as AllergyKind)}>
									<SelectTrigger className={styles.control} aria-label='Kind'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ALLERGY_KINDS.map((option) => (
											<SelectItem key={option} value={option}>
												{option}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</FormField>
						<FormField label='Severity'>
							{() => (
								<Select
									value={severity}
									onValueChange={(value) => setSeverity(value as AllergySeverity)}
								>
									<SelectTrigger className={styles.control} aria-label='Severity'>
										<SelectValue placeholder='Not known' />
									</SelectTrigger>
									<SelectContent>
										{ALLERGY_SEVERITIES.map((option) => (
											<SelectItem key={option} value={option}>
												{option}
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
						<Button type='submit' disabled={!substance.trim() || add.isPending}>
							Add allergy
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
