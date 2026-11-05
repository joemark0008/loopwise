import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import styles from './clinic-setup.module.css';
import { LoadError } from './setup-form';
import type { DocumentSequenceSetting } from '@/lib/clinic-setup-api';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { SettingsCard } from '@/components/ui/settings-card';
import { Skeleton } from '@/components/ui/skeleton';
import { clinicSetupApi } from '@/lib/clinic-setup-api';

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/**
 * Settings → Clinic → Numbering: how this clinic numbers its patients, visits, lab orders, prescriptions,
 * certificates, invoices and payments this year. The prefix carries the year (numbers restart each year) and the
 * format carries into the next year.
 */
export function NumberingPage() {
	const sequences = useQuery(clinicSetupApi.sequences.queryOptions({}));
	const year = sequences.data?.[0]?.year;
	return (
		<SettingsCard
			title={year ? `Document numbers in ${year}` : 'Document numbers'}
			description='Prefix and digits of each numbered document. Numbers already issued keep their format.'
		>
			{sequences.error ? (
				<LoadError message={sequences.error.message} onRetry={() => void sequences.refetch()} />
			) : !sequences.data ? (
				<Skeleton className={styles.form} />
			) : (
				<div className={styles.tableScroll}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th scope='col'>Document</th>
								<th scope='col'>Prefix</th>
								<th scope='col'>Digits</th>
								<th scope='col'>Next number</th>
								<th scope='col'>
									<span className='sr-only'>Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{sequences.data.map((sequence) => (
								<SequenceRow
									key={`${sequence.key}-${sequence.prefix}-${sequence.padLength}`}
									sequence={sequence}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</SettingsCard>
	);
}

function SequenceRow({ sequence }: { sequence: DocumentSequenceSetting }) {
	const queryClient = useQueryClient();
	const [prefix, setPrefix] = useState(sequence.prefix);
	const [padLength, setPadLength] = useState(String(sequence.padLength));
	const save = useMutation(
		clinicSetupApi.setSequence.mutationOptions({
			onSuccess: () => queryClient.invalidateQueries(clinicSetupApi.sequences.pathFilter()),
		}),
	);
	const digits = Number(padLength);
	const validDigits = Number.isInteger(digits) && digits >= 3 && digits <= 10;
	const changed = prefix !== sequence.prefix || digits !== sequence.padLength;
	const missingYear = !prefix.includes(String(sequence.year));
	const formId = `sequence-${sequence.key}`;

	return (
		<tr>
			<th scope='row'>
				{sequence.label}
				{!sequence.isStarted && <div className={styles.muted}>None issued yet this year</div>}
			</th>
			<td>
				<Input
					form={formId}
					aria-label={`Prefix of ${sequence.label}`}
					aria-invalid={missingYear || undefined}
					className={styles.code}
					value={prefix}
					maxLength={24}
					onChange={(event) => setPrefix(event.target.value)}
				/>
				{missingYear && <p className={styles.fieldError}>Put {sequence.year} in the prefix.</p>}
				{save.error && <ErrorMessage message={save.error.message} />}
			</td>
			<td>
				<Input
					form={formId}
					aria-label={`Digits of ${sequence.label}`}
					type='number'
					min={3}
					max={10}
					value={padLength}
					onChange={(event) => setPadLength(event.target.value)}
				/>
			</td>
			<td className={styles.preview}>
				{validDigits ? `${prefix}${pad(sequence.nextValue, digits)}` : sequence.preview}
			</td>
			<td>
				<form
					id={formId}
					className={styles.rowActions}
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate({ key: sequence.key, prefix: prefix.trim(), padLength: digits });
					}}
				>
					<Button
						type='submit'
						size='sm'
						variant='outline'
						disabled={!changed || !validDigits || missingYear || save.isPending}
						aria-label={`Save ${sequence.label}`}
					>
						Save
					</Button>
				</form>
			</td>
		</tr>
	);
}
