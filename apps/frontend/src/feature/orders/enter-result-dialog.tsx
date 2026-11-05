import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './lab-worklist.module.css';
import { parameterRange, personName } from './order-format';
import type { LabWorklistItemFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/feature/encounters/form-field';
import { ordersApi } from '@/lib/orders-api';

type Entry = { value: string; critical: boolean };

/** The form's starting values: the entered result when there is one (an edit or a correction), else blank. */
function initialEntries(item: LabWorklistItemFieldsFragment): Record<string, Entry> {
	return Object.fromEntries(
		item.test.parameters.map((parameter) => {
			const entered = item.result?.values.find((value) => value.parameterId === parameter.id);
			return [
				parameter.id,
				{
					value: entered?.value ?? '',
					critical: entered?.flag === 'CRITICAL_HIGH' || entered?.flag === 'CRITICAL_LOW',
				},
			];
		}),
	);
}

/**
 * Entering a test's result on the lab worklist: one field per analyte with the patient's reference range (the API
 * flags each value from it), "critical" for a value the lab calls in, or the findings and impression of an imaging
 * report. A released result entered again is a correction: it needs releasing, and the doctor's review, again.
 */
export function EnterResultDialog({
	item,
	onOpenChange,
}: {
	item: LabWorklistItemFieldsFragment | null;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={item !== null} onOpenChange={onOpenChange}>
			<DialogContent>
				{item && <EnterResultForm key={item.id} item={item} onDone={() => onOpenChange(false)} />}
			</DialogContent>
		</Dialog>
	);
}

function EnterResultForm({ item, onDone }: { item: LabWorklistItemFieldsFragment; onDone: () => void }) {
	const queryClient = useQueryClient();
	const [entries, setEntries] = useState(() => initialEntries(item));
	const [findings, setFindings] = useState(item.result?.findings ?? '');
	const [impression, setImpression] = useState(item.result?.impression ?? '');
	const [remarks, setRemarks] = useState('');
	const enter = useMutation(
		ordersApi.order.enterResult.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries(ordersApi.order.worklist.pathFilter());
				onDone();
			},
		}),
	);
	const correcting = item.status === 'RELEASED';
	const sex = item.patient.sex as 'MALE' | 'FEMALE';
	const isImaging = item.test.parameters.length === 0;
	const set = (id: string, patch: Partial<Entry>) => setEntries({ ...entries, [id]: { ...entries[id], ...patch } });

	return (
		<form
			className={styles.resultForm}
			onSubmit={(event) => {
				event.preventDefault();
				enter.mutate({
					itemId: item.id,
					values: item.test.parameters.map((parameter) => ({
						parameterId: parameter.id,
						value: entries[parameter.id].value,
						critical: entries[parameter.id].critical || null,
					})),
					findings: findings.trim() || null,
					impression: impression.trim() || null,
					remarks: remarks.trim() || null,
				});
			}}
		>
			<DialogHeader>
				<DialogTitle>
					{correcting ? 'Correct the result' : 'Enter the result'}: {item.test.name}
				</DialogTitle>
				<DialogDescription>
					{personName(item.patient)} · {item.order.orderNo}
					{item.accessionNo && ` · ${item.accessionNo}`}
				</DialogDescription>
			</DialogHeader>
			{isImaging ? (
				<>
					<FormField label='Findings'>
						{(id) => (
							<Textarea
								id={id}
								rows={4}
								value={findings}
								onChange={(event) => setFindings(event.target.value)}
							/>
						)}
					</FormField>
					<FormField label='Impression'>
						{(id) => (
							<Textarea
								id={id}
								rows={2}
								value={impression}
								onChange={(event) => setImpression(event.target.value)}
							/>
						)}
					</FormField>
				</>
			) : (
				<div className={styles.resultGrid} data-testid='result-values'>
					{item.test.parameters.map((parameter) => {
						const range = parameterRange(parameter, sex);
						return (
							<div key={parameter.id} className={styles.resultRow}>
								<FormField
									label={parameter.name}
									unit={
										[parameter.unit, range && `ref ${range}`].filter(Boolean).join(', ') ||
										undefined
									}
								>
									{(id) =>
										parameter.valueType === 'OPTION' && parameter.options.length > 0 ? (
											<select
												id={id}
												className={styles.select}
												value={entries[parameter.id].value}
												onChange={(event) => set(parameter.id, { value: event.target.value })}
											>
												<option value=''>Not done</option>
												{parameter.options.map((option) => (
													<option key={option} value={option}>
														{option}
													</option>
												))}
											</select>
										) : (
											<Input
												id={id}
												inputMode={parameter.valueType === 'NUMERIC' ? 'decimal' : undefined}
												value={entries[parameter.id].value}
												onChange={(event) => set(parameter.id, { value: event.target.value })}
											/>
										)
									}
								</FormField>
								{parameter.valueType === 'NUMERIC' && (
									<label className={styles.critical}>
										<Checkbox
											checked={entries[parameter.id].critical}
											onCheckedChange={(critical) => set(parameter.id, { critical })}
											aria-label={`${parameter.name} is critical`}
										/>
										Critical
									</label>
								)}
							</div>
						);
					})}
				</div>
			)}
			{correcting && (
				<FormField label='What changed and why'>
					{(id) => (
						<Input
							id={id}
							value={remarks}
							placeholder='Transcription error'
							onChange={(event) => setRemarks(event.target.value)}
						/>
					)}
				</FormField>
			)}
			{enter.error && <ErrorMessage message={enter.error.message} />}
			<DialogFooter>
				<Button type='button' variant='ghost-muted' onClick={onDone}>
					Cancel
				</Button>
				<Button type='submit' disabled={enter.isPending || (correcting && !remarks.trim())}>
					Save result
				</Button>
			</DialogFooter>
		</form>
	);
}
