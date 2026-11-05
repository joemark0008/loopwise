import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
	defaultEncounterClinicId,
	emptyEncounterForm,
	toCreateEncounterInput,
	validateEncounterForm,
} from './encounter-form-values';
import { EncounterFields } from './encounter-fields';
import styles from './patient-chart.module.css';
import type { EncounterFormValues } from './encounter-form-values';
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
import { useActiveClinicId } from '@/lib/active-clinic';
import { encounterApi } from '@/lib/encounter-api';

/** Records a visit by hand; Wise's `propose_encounter` card does the same from the chart chat. */
export function NewEncounterDialog({
	patientId,
	clinics,
	open,
	onOpenChange,
}: {
	patientId: string;
	clinics: { id: string; name: string }[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const activeClinicId = useActiveClinicId();
	const initial = () => emptyEncounterForm();
	const [draft, setValues] = useState<EncounterFormValues>(initial);
	// The clinics may load after the dialog mounts: until the user picks one, the visit starts at the active clinic.
	const values = { ...draft, clinicId: draft.clinicId || defaultEncounterClinicId(clinics, activeClinicId) };
	const [showErrors, setShowErrors] = useState(false);
	const create = useMutation(
		encounterApi.encounter.create.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(encounterApi.encounter.list.pathFilter()),
		}),
	);
	const errors = validateEncounterForm(values);

	const close = (next: boolean) => {
		if (!next) {
			setValues(initial());
			setShowErrors(false);
			create.reset();
		}
		onOpenChange(next);
	};

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		setShowErrors(true);
		if (Object.keys(errors).length === 0) {
			create.mutate(toCreateEncounterInput(patientId, values), { onSuccess: () => close(false) });
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className={styles.chartDialog}>
				<form onSubmit={submit} noValidate className={styles.chartDialogForm}>
					<DialogHeader>
						<DialogTitle>New encounter</DialogTitle>
						<DialogDescription>
							Record a visit. You can also describe it to Wise in the chart chat.
						</DialogDescription>
					</DialogHeader>
					<EncounterFields
						values={values}
						errors={showErrors ? errors : {}}
						clinics={clinics}
						onChange={setValues}
						disabled={create.isPending}
					/>
					{create.error && <ErrorMessage message={create.error.message} />}
					<DialogFooter>
						<Button type='button' variant='ghost-muted' onClick={() => close(false)}>
							Cancel
						</Button>
						<Button type='submit' disabled={create.isPending}>
							Save encounter
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
