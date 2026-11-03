import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { resultValue, testName } from './result-format';
import { ResultFlagCell } from './result-flag-cell';
import styles from './results.module.css';
import type { ResultItemFieldsFragment } from '@/graphql/generated/graphql';
import { patientName } from '@/feature/patients/patient-format';
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
import { Textarea } from '@/components/ui/textarea';
import { resultApi } from '@/lib/result-api';

/** Marks a result reviewed, with an optional note kept in the audit trail. */
export function ReviewResultDialog({
	result,
	onOpenChange,
}: {
	result: ResultItemFieldsFragment | null;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [note, setNote] = useState('');
	const review = useMutation(
		resultApi.result.review.mutationOptions({
			onSuccess: () =>
				Promise.all([
					queryClient.invalidateQueries(resultApi.result.toReview.pathFilter()),
					queryClient.invalidateQueries(resultApi.result.forPatient.pathFilter()),
				]),
		}),
	);

	const close = (open: boolean) => {
		if (!open) {
			setNote('');
			review.reset();
		}
		onOpenChange(open);
	};

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		if (result) {
			review.mutate({ resultId: result.id, note: note.trim() || null }, { onSuccess: () => close(false) });
		}
	};

	return (
		<Dialog open={result !== null} onOpenChange={close}>
			<DialogContent>
				{result && (
					<form onSubmit={submit} className={styles.reviewForm}>
						<DialogHeader>
							<DialogTitle>Mark reviewed</DialogTitle>
							<DialogDescription>
								{patientName(result.patient)}: {testName(result)} {resultValue(result)}
							</DialogDescription>
						</DialogHeader>
						<div className={styles.reviewFlag}>
							<ResultFlagCell result={result} />
							{result.refRange && <span>Reference {result.refRange}</span>}
						</div>
						{result.value.includes('\n') && <pre className={styles.report}>{result.value}</pre>}
						<label className={styles.noteLabel} htmlFor='review-note'>
							Note (optional)
						</label>
						<Textarea
							id='review-note'
							value={note}
							maxLength={1000}
							onChange={(event) => setNote(event.target.value)}
							placeholder='e.g. Diabetes range; discuss at follow-up'
						/>
						{review.error && <ErrorMessage message={review.error.message} />}
						<DialogFooter>
							<Button type='button' variant='ghost-muted' onClick={() => close(false)}>
								Cancel
							</Button>
							<Button type='submit' disabled={review.isPending}>
								Mark reviewed
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
