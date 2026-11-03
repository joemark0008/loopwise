import { computeBmi, VITAL_FIELDS, VITAL_RANGES, vitalFlag } from '@quarry/shared/vitals';
import { useState } from 'react';
import styles from './encounter.module.css';
import { emptyVitalsForm, toRecordVitalsInput, validateVitalsForm } from './encounter-form-values';
import { formatDateTime } from './encounter-format';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import { VoidDialog } from './void-dialog';
import type { VitalsFormValues } from './encounter-form-values';
import type { VitalFlag } from '@quarry/shared/vitals';
import type { EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { FlaggedValue } from '@/components/clinical/clinical-flag';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { encounterRecordApi } from '@/lib/encounter-record-api';

type Vitals = EncounterRecordFieldsFragment['vitals'][number];

const SEVERITY: VitalFlag[] = ['normal', 'low', 'high', 'critical_low', 'critical_high'];
const worst = (...flags: (VitalFlag | null)[]) =>
	flags.reduce<VitalFlag | null>(
		(current, flag) => (flag && SEVERITY.indexOf(flag) > SEVERITY.indexOf(current ?? 'normal') ? flag : current),
		null,
	);

/** Each column with its unit in the header and, where adults have a reference range, its flag. */
const COLUMNS: {
	label: string;
	unit?: string;
	value: (row: Vitals) => string | number | null;
	flag?: (row: Vitals) => VitalFlag | null;
}[] = [
	{
		label: 'BP',
		unit: 'mmHg',
		value: (row) => (row.systolicMmHg !== null ? `${row.systolicMmHg}/${row.diastolicMmHg}` : null),
		flag: (row) =>
			worst(vitalFlag('systolicMmHg', row.systolicMmHg), vitalFlag('diastolicMmHg', row.diastolicMmHg)),
	},
	{
		label: 'HR',
		unit: 'bpm',
		value: (row) => row.heartRateBpm,
		flag: (row) => vitalFlag('heartRateBpm', row.heartRateBpm),
	},
	{
		label: 'RR',
		unit: '/min',
		value: (row) => row.respiratoryRate,
		flag: (row) => vitalFlag('respiratoryRate', row.respiratoryRate),
	},
	{
		label: 'Temp',
		unit: '°C',
		value: (row) => row.temperatureC?.toFixed(1) ?? null,
		flag: (row) => vitalFlag('temperatureC', row.temperatureC),
	},
	{ label: 'SpO₂', unit: '%', value: (row) => row.spo2Pct, flag: (row) => vitalFlag('spo2Pct', row.spo2Pct) },
	{ label: 'Wt', unit: 'kg', value: (row) => row.weightKg },
	{ label: 'Ht', unit: 'cm', value: (row) => row.heightCm },
	{ label: 'BMI', value: (row) => row.bmi?.toFixed(1) ?? null },
	{
		label: 'CBG',
		unit: 'mg/dL',
		value: (row) => row.bloodGlucoseMgDl,
		flag: (row) => vitalFlag('bloodGlucoseMgDl', row.bloodGlucoseMgDl),
	},
	{ label: 'Pain', unit: '/10', value: (row) => row.painScore, flag: (row) => vitalFlag('painScore', row.painScore) },
];

/** Vital signs: a form for a new set (BMI shown as you type) and every set taken during the visit. */
export function VitalsTab({ record }: { record: EncounterRecordFieldsFragment }) {
	const [values, setValues] = useState<VitalsFormValues>(emptyVitalsForm);
	const [showErrors, setShowErrors] = useState(false);
	const [voiding, setVoiding] = useState<Vitals | null>(null);
	const recordVitals = useRecordMutation(encounterRecordApi.encounterRecord.recordVitals);
	const voidVitals = useRecordMutation(encounterRecordApi.encounterRecord.voidVitals);
	const errors = validateVitalsForm(values);
	const bmi = computeBmi(Number(values.weightKg) || undefined, Number(values.heightCm) || undefined);

	return (
		<>
			{record.canEdit && (
				<form
					className={styles.section}
					noValidate
					onSubmit={(event) => {
						event.preventDefault();
						setShowErrors(true);
						if (Object.keys(errors).length === 0) {
							recordVitals.mutate(toRecordVitalsInput(record.encounter.id, values), {
								onSuccess: () => {
									setValues(emptyVitalsForm());
									setShowErrors(false);
								},
							});
						}
					}}
				>
					<h3 className={styles.sectionTitle}>Record vitals</h3>
					<div className={styles.fields}>
						{VITAL_FIELDS.map((field) => (
							<FormField
								key={field}
								label={VITAL_RANGES[field].label}
								unit={VITAL_RANGES[field].unit}
								error={showErrors ? errors[field] : undefined}
							>
								{(id) => (
									<Input
										id={id}
										inputMode='decimal'
										value={values[field]}
										onChange={(event) => setValues({ ...values, [field]: event.target.value })}
										disabled={recordVitals.isPending}
										aria-invalid={showErrors && errors[field] ? true : undefined}
									/>
								)}
							</FormField>
						))}
					</div>
					<p className={styles.muted} data-testid='bmi-preview'>
						BMI: {bmi !== undefined ? bmi.toFixed(1) : '—'}
					</p>
					{recordVitals.error && <ErrorMessage message={recordVitals.error.message} />}
					<div className={styles.actions}>
						<Button type='submit' size='sm' disabled={recordVitals.isPending}>
							Save vitals
						</Button>
					</div>
				</form>
			)}
			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>Taken this visit</h3>
				{record.vitals.length === 0 ? (
					<Empty>No vitals recorded yet.</Empty>
				) : (
					<div className={styles.tableScroll} role='region' aria-label='Vitals taken this visit' tabIndex={0}>
						<table className={styles.table} data-testid='vitals-table'>
							<thead>
								<tr>
									<th scope='col'>Time</th>
									{COLUMNS.map((column) => (
										<th key={column.label} scope='col' data-numeric>
											{column.label}
											{column.unit && <span className={styles.unit}> {column.unit}</span>}
										</th>
									))}
									<th aria-label='Actions' />
								</tr>
							</thead>
							<tbody>
								{record.vitals.map((row) => (
									<tr
										key={row.id}
										data-voided={row.voidedAt ? true : undefined}
										title={row.voidReason ?? undefined}
									>
										<td>{formatDateTime(row.recordedAt)}</td>
										{COLUMNS.map((column) => (
											<td key={column.label} data-numeric>
												<FlaggedValue flag={row.voidedAt ? null : column.flag?.(row)}>
													{column.value(row) ?? '—'}
												</FlaggedValue>
											</td>
										))}
										<td>
											{record.canEdit && !row.voidedAt && (
												<Button size='sm' variant='ghost-muted' onClick={() => setVoiding(row)}>
													Void
												</Button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
			<VoidDialog
				open={voiding !== null}
				onOpenChange={(open) => !open && setVoiding(null)}
				title='Void vitals'
				description='The measurements stay in the record, struck through.'
				isPending={voidVitals.isPending}
				error={voidVitals.error?.message}
				onVoid={(reason) =>
					voiding && voidVitals.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })
				}
			/>
		</>
	);
}
