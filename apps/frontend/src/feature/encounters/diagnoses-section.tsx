import { useQuery } from '@tanstack/react-query';
import { DIAGNOSIS_CERTAINTIES } from '@loopwise/shared/encounter-record';
import { ICD10_CODE_PATTERN, normalizeIcd10Code } from '@loopwise/shared/icd10';
import { useState } from 'react';
import styles from './encounter.module.css';
import { FormField } from './form-field';
import { useRecordMutation } from './use-record-mutation';
import { VoidDialog } from './void-dialog';
import type { DiagnosisCertainty, EncounterRecordFieldsFragment } from '@/graphql/generated/graphql';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { encounterRecordApi } from '@/lib/encounter-record-api';

type Diagnosis = EncounterRecordFieldsFragment['diagnoses'][number];

/** The visit's ICD-10 diagnoses: one primary, provisional or confirmed; wrong ones are voided. */
export function DiagnosesSection({ record }: { record: EncounterRecordFieldsFragment }) {
	const [voiding, setVoiding] = useState<Diagnosis | null>(null);
	const update = useRecordMutation(encounterRecordApi.encounterRecord.updateDiagnosis);
	const voidDiagnosis = useRecordMutation(encounterRecordApi.encounterRecord.voidDiagnosis);

	return (
		<section className={styles.section} aria-labelledby='diagnoses-title'>
			<div className={styles.sectionHeader}>
				<h3 id='diagnoses-title' className={styles.sectionTitle}>
					Diagnoses (ICD-10)
				</h3>
			</div>
			{record.diagnoses.length === 0 ? (
				<Empty>No diagnosis yet.</Empty>
			) : (
				<ul className={styles.list} data-testid='diagnosis-list'>
					{record.diagnoses.map((diagnosis) => (
						<li
							key={diagnosis.id}
							className={styles.listRow}
							data-voided={diagnosis.voidedAt ? true : undefined}
						>
							<span className={styles.code}>{diagnosis.icd10Code}</span>
							<span className={styles.listMain}>
								{diagnosis.display}
								{diagnosis.voidReason && (
									<span className={styles.muted}> · voided: {diagnosis.voidReason}</span>
								)}
							</span>
							{diagnosis.isPrimary && !diagnosis.voidedAt && <Badge variant='default'>Primary</Badge>}
							<Badge variant='outline'>
								{diagnosis.certainty === 'provisional' ? 'Provisional' : 'Confirmed'}
							</Badge>
							{record.canEdit && !diagnosis.voidedAt && (
								<span className={styles.actions}>
									{!diagnosis.isPrimary && (
										<Button
											size='sm'
											variant='ghost'
											disabled={update.isPending}
											onClick={() => update.mutate({ id: diagnosis.id, isPrimary: true })}
										>
											Make primary
										</Button>
									)}
									{diagnosis.certainty === 'provisional' && (
										<Button
											size='sm'
											variant='ghost'
											disabled={update.isPending}
											onClick={() => update.mutate({ id: diagnosis.id, certainty: 'confirmed' })}
										>
											Confirm
										</Button>
									)}
									<Button size='sm' variant='ghost-muted' onClick={() => setVoiding(diagnosis)}>
										Void
									</Button>
								</span>
							)}
						</li>
					))}
				</ul>
			)}
			{update.error && <ErrorMessage message={update.error.message} />}
			{record.canEdit && <AddDiagnosisForm encounterId={record.encounter.id} />}
			<VoidDialog
				open={voiding !== null}
				onOpenChange={(open) => !open && setVoiding(null)}
				title='Void diagnosis'
				description={
					voiding ? `${voiding.icd10Code} ${voiding.display} stays in the record, struck through.` : ''
				}
				isPending={voidDiagnosis.isPending}
				error={voidDiagnosis.error?.message}
				onVoid={(reason) =>
					voiding && voidDiagnosis.mutate({ id: voiding.id, reason }, { onSuccess: () => setVoiding(null) })
				}
			/>
		</section>
	);
}

function AddDiagnosisForm({ encounterId }: { encounterId: string }) {
	const [search, setSearch] = useState('');
	const [picked, setPicked] = useState<{ code: string; title: string } | null>(null);
	const [certainty, setCertainty] = useState<DiagnosisCertainty>('provisional');
	const query = useDebouncedValue(search, 200);
	const suggestions = useQuery({
		...encounterRecordApi.encounterRecord.searchIcd10.queryOptions({ query }),
		enabled: !picked && query.trim().length > 0,
	});
	const add = useRecordMutation(encounterRecordApi.encounterRecord.addDiagnosis);
	// A code typed in full (e.g. "J06.9 URTI") can be added without picking from the list.
	const typedCode = normalizeIcd10Code(search.split(/\s+/)[0] ?? '');
	const typed =
		ICD10_CODE_PATTERN.test(typedCode) && search.trim().includes(' ')
			? { code: typedCode, title: search.trim().slice(search.trim().indexOf(' ') + 1) }
			: null;
	const chosen = picked ?? typed;

	const reset = () => {
		setSearch('');
		setPicked(null);
		setCertainty('provisional');
	};

	return (
		<form
			className={styles.section}
			onSubmit={(event) => {
				event.preventDefault();
				if (chosen) {
					add.mutate(
						{ encounterId, icd10Code: chosen.code, display: chosen.title, certainty },
						{ onSuccess: reset },
					);
				}
			}}
		>
			<div className={styles.fields}>
				<FormField label='Add a diagnosis' wide>
					{(id) => (
						<Input
							id={id}
							value={picked ? `${picked.code} ${picked.title}` : search}
							placeholder='Search ICD-10 by code or words, e.g. "I10" or "hypertension"'
							onChange={(event) => {
								setPicked(null);
								setSearch(event.target.value);
							}}
							disabled={add.isPending}
						/>
					)}
				</FormField>
				<FormField label='Certainty'>
					{() => (
						<Select value={certainty} onValueChange={(value) => setCertainty(value as DiagnosisCertainty)}>
							<SelectTrigger className={styles.control} aria-label='Certainty'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DIAGNOSIS_CERTAINTIES.map((option) => (
									<SelectItem key={option} value={option}>
										{option === 'provisional' ? 'Provisional' : 'Confirmed'}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</FormField>
			</div>
			{!picked && suggestions.data && suggestions.data.length > 0 && (
				<ul className={styles.suggestions} aria-label='ICD-10 suggestions'>
					{suggestions.data.map((entry) => (
						<li key={entry.code}>
							<button type='button' className={styles.suggestion} onClick={() => setPicked(entry)}>
								<span className={styles.code}>{entry.code}</span>
								<span>{entry.title}</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{add.error && <ErrorMessage message={add.error.message} />}
			<div className={styles.actions}>
				<Button type='submit' size='sm' variant='outline' disabled={!chosen || add.isPending}>
					Add diagnosis
				</Button>
			</div>
		</form>
	);
}
