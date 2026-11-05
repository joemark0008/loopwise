import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ResultValues } from './result-values';
import { ResultFlagCell } from './result-flag-cell';
import styles from './results.module.css';
import type { DiagnosticReportFieldsFragment } from '@/graphql/generated/graphql';
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
import { personName } from '@/feature/orders/order-format';
import { resultApi } from '@/lib/result-api';

/** Marks a released result reviewed, with an optional note kept in the audit trail. */
export function ReviewResultDialog({
	result,
	onOpenChange,
}: {
	result: DiagnosticReportFieldsFragment | null;
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
								{personName(result.patient)}: {result.test.name} · {result.order.orderNo}
							</DialogDescription>
						</DialogHeader>
						<div className={styles.reviewFlag}>
							<ResultFlagCell result={result} />
							<span>Released by {result.clinicName}</span>
						</div>
						<ResultValues result={result} />
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
