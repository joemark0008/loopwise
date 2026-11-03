import { UserPlus } from 'lucide-react';
import { memo, useState } from 'react';
import { ProposalCard } from './proposal-card/proposal-card';
import styles from './propose-patient-registration.module.css';
import type { ProposalConfirm } from './proposal-card/proposal-card';
import type { proposePatientRegistration } from '@loopwise/shared/tools';
import type { PatientFormValues } from '@/feature/patients/patient-form-values';
import type { ToolCallComponentProps } from '.';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentContext } from '@/contexts/agent.provider';
import { DuplicateAlert } from '@/feature/patients/duplicate-alert';
import { languageLabel } from '@/feature/patients/patient-format';
import { PatientFields } from '@/feature/patients/patient-fields';
import { emptyPatientForm, validatePatientForm } from '@/feature/patients/patient-form-values';
import { usePatientRegistration } from '@/feature/patients/use-patient-registration';

const REGISTERED_ANSWER = /^I (registered|used the existing record of) /;
const TOOL_NAME = 'propose_patient_registration';

/** Wise's patient registration draft: the clinician checks it, records consent and confirms (DESIGN.md §9.1). */
export const ProposePatientRegistrationToolCall = memo(
	({ toolPart }: ToolCallComponentProps<'propose_patient_registration'>) => {
		if (toolPart.state === 'input-streaming' || toolPart.state === 'input-available') {
			return <Skeleton className={styles.registrationSkeleton} />;
		}
		if (toolPart.state === 'output-error') {
			return <ErrorMessage message={toolPart.errorText} />;
		}
		if (!toolPart.input || !toolPart.output) {
			return null;
		}
		return <RegistrationCard toolCallId={toolPart.toolCallId} draft={toolPart.input} output={toolPart.output} />;
	},
);

function RegistrationCard({
	toolCallId,
	draft,
	output,
}: {
	toolCallId: string;
	draft: proposePatientRegistration.Input;
	output: proposePatientRegistration.Output;
}) {
	const { queueOrSendMessage, chatId } = useAgentContext();
	const [values, setValues] = useState<PatientFormValues>(() => fromDraft(draft, output.facilities));
	const [isEditing, setIsEditing] = useState(false);
	const [isEdited, setIsEdited] = useState(false);
	const [consentGiven, setConsentGiven] = useState(false);
	const [showErrors, setShowErrors] = useState(false);
	const registration = usePatientRegistration({
		onDone: (patient, outcome) => {
			const name = `${patient.givenName} ${patient.familyName}`;
			const mrn = patient.identifiers.find((identifier) => identifier.system === 'MRN')?.value;
			void queueOrSendMessage({
				text:
					outcome === 'registered'
						? `I registered ${name}${mrn ? ` (MRN ${mrn})` : ''}.`
						: `I used the existing record of ${name} instead of registering them again.`,
			});
		},
	});

	const errors = validatePatientForm(values);
	const isValid = Object.keys(errors).length === 0;
	// The tool's own check covers the draft as proposed; after an edit the API checks again on Confirm.
	const duplicates = registration.duplicates.length > 0 || isEdited ? registration.duplicates : output.duplicates;
	const isBlocked = duplicates.some((duplicate) => duplicate.match === 'EXACT_IDENTIFIER');

	const confirm = ({ origin }: ProposalConfirm) => {
		setShowErrors(true);
		if (!isValid) {
			setIsEditing(true);
			return;
		}
		if (consentGiven) {
			return registration.submit(values, consentGiven, duplicates.length > 0 && !isBlocked, {
				...origin,
				edited: isEdited,
			});
		}
	};

	return (
		<ProposalCard
			toolCallId={toolCallId}
			toolName={TOOL_NAME}
			icon={UserPlus}
			title='Register patient'
			testId='propose-patient-registration'
			confirmLabel={duplicates.length > 0 && !isBlocked ? 'Register as new patient' : 'Register patient'}
			onConfirm={confirm}
			isConfirmDisabled={!consentGiven || isBlocked}
			isPending={registration.isPending}
			isEditing={isEditing}
			onEditToggle={() => setIsEditing(!isEditing)}
			error={registration.error?.message}
			resolvedLabels={{ confirmed: 'Registered', cancelled: 'Not registered' }}
			isConfirmedAnswer={(answer) => REGISTERED_ANSWER.test(answer)}
			warnings={
				<>
					<DuplicateAlert
						duplicates={duplicates}
						isPending={registration.isPending}
						onUseExisting={(patientId) => {
							setShowErrors(true);
							if (isValid && consentGiven && chatId) {
								void registration.linkExisting(values, consentGiven, patientId, {
									chatId,
									toolCallId,
									toolName: TOOL_NAME,
									edited: isEdited,
								});
							}
						}}
					/>
					<label className={styles.registrationConsent}>
						<Checkbox checked={consentGiven} onCheckedChange={setConsentGiven} aria-label='Consent' />
						<span>The patient agrees to be registered and to have their results followed up.</span>
					</label>
				</>
			}
		>
			{isEditing ? (
				<PatientFields
					values={values}
					errors={showErrors ? errors : {}}
					facilities={output.facilities}
					disabled={registration.isPending}
					onChange={(next) => {
						setValues(next);
						setIsEdited(true);
						registration.clearDuplicates();
					}}
				/>
			) : (
				<Summary values={values} errors={showErrors ? errors : {}} facilities={output.facilities} />
			)}
		</ProposalCard>
	);
}

function Summary({
	values,
	errors,
	facilities,
}: {
	values: PatientFormValues;
	errors: ReturnType<typeof validatePatientForm>;
	facilities: proposePatientRegistration.Facility[];
}) {
	const facility = facilities.find((candidate) => candidate.id === values.facilityId)?.name;
	const rows: [string, string, string | undefined][] = [
		['Name', `${values.givenName} ${values.familyName}`.trim(), errors.givenName ?? errors.familyName],
		['Birth date', values.birthDate, errors.birthDate],
		['Sex', values.sex && values.sex.charAt(0).toUpperCase() + values.sex.slice(1), errors.sex],
		['MRN', values.mrn, errors.mrn],
		['PhilHealth', values.philHealthId, errors.philHealthId],
		['Mobile', values.phone, errors.phone],
		['Language', languageLabel(values.preferredLanguage), undefined],
		['Facility', facility ?? '', errors.facilityId],
	];
	return (
		<dl className={styles.registrationSummary}>
			{rows.map(([label, value, error]) => (
				<div key={label} className={styles.registrationRow}>
					<dt>{label}</dt>
					<dd data-missing={!value || undefined}>
						{value || 'Not given'}
						{error && <span className={styles.registrationError}> · {error}</span>}
					</dd>
				</div>
			))}
		</dl>
	);
}

function fromDraft(
	draft: proposePatientRegistration.Input,
	facilities: proposePatientRegistration.Facility[],
): PatientFormValues {
	const empty = emptyPatientForm(facilities.length === 1 ? facilities[0].id : '');
	return {
		...empty,
		givenName: draft.givenName ?? '',
		familyName: draft.familyName ?? '',
		birthDate: draft.birthDate ?? '',
		sex: draft.sex ?? '',
		phone: draft.phone ?? '',
		preferredLanguage: (draft.preferredLanguage as PatientFormValues['preferredLanguage']) ?? 'en',
		mrn: draft.mrn ?? '',
		philHealthId: draft.philHealthId ?? '',
	};
}
