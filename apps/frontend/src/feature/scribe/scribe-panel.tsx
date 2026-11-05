import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	RECORDING_CONSENT_TEXT,
	SCRIBE_LANGUAGE_LABELS,
	SCRIBE_LANGUAGES,
	SCRIBE_TRANSCRIPT_MAX_LENGTH,
	scribeRequestMessage,
} from '@loopwise/shared/scribe';
import { CircleCheck, CircleSlash, Mic, Sparkles, Square } from 'lucide-react';
import { useState } from 'react';
import { ScribeCards } from './scribe-cards';
import { latestScribeDraft, sameDraft, summaryLanguageFor } from './scribe-draft';
import styles from './scribe.module.css';
import type { ScribeLanguage } from '@loopwise/shared/scribe';
import type { EncounterRecordFieldsFragment, RecordingConsentFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { Textarea } from '@/components/ui/textarea';
import { useAgentMessagesSelector, useOptionalAgentContext } from '@/contexts/agent.provider';
import { useTranscribe } from '@/hooks/use-transcribe';
import { clinicApi } from '@/lib/clinic-api';
import { patientApi } from '@/lib/patient-api';
import { scribeApi, transcribeVisit } from '@/lib/scribe-api';

const storageKey = (encounterId: string) => `loopwise.scribe.transcript.${encounterId}`;

function readStored(encounterId: string): string {
	try {
		return sessionStorage.getItem(storageKey(encounterId)) ?? '';
	} catch {
		return '';
	}
}

function store(encounterId: string, text: string) {
	try {
		sessionStorage.setItem(storageKey(encounterId), text);
	} catch {
		// Private mode: the transcript just isn't kept across tabs.
	}
}

/**
 * The AI scribe on the encounter page (PLAN.md §4.3, DESIGN.md §7.5). The doctor records the consult (only with the
 * patient's consent for this visit) or types a dictation, picks the language of the patient summary, and asks Wise to
 * draft the visit; the draft comes back as one card per part (SOAP, vitals, diagnoses, prescription, tests,
 * certificate, follow-up, patient summary), each confirmed, edited or dismissed here. The request and Wise's reply
 * are in the patient's chart chat beside the page.
 */
export function ScribePanel({ record }: { record: EncounterRecordFieldsFragment }) {
	const agent = useOptionalAgentContext();
	if (!agent) {
		return (
			<ErrorMessage message='Wise isn’t available for this patient right now. Reload the page to try again.' />
		);
	}
	return <ScribeWorkspace record={record} />;
}

function ScribeWorkspace({ record }: { record: EncounterRecordFieldsFragment }) {
	const agent = useOptionalAgentContext()!;
	const encounterId = record.encounter.id;
	const patient = useQuery(patientApi.patient.get.queryOptions({ id: record.encounter.patientId }));
	const [transcript, setTranscript] = useState(() => readStored(encounterId));
	const [language, setLanguage] = useState<ScribeLanguage | null>(null);
	const [recordError, setRecordError] = useState<string>();
	const draft = useAgentMessagesSelector((messages) => latestScribeDraft(messages, encounterId), sameDraft);
	const chosenLanguage = language ?? summaryLanguageFor(patient.data?.preferredLanguage);

	const update = (text: string) => {
		const next = text.slice(0, SCRIBE_TRANSCRIPT_MAX_LENGTH);
		setTranscript(next);
		store(encounterId, next);
	};
	const recorder = useTranscribe({
		onTranscribed: (text) => update(transcript.trim() ? `${transcript.trim()}\n${text}` : text),
		transcribe: ({ audio }) => transcribeVisit(encounterId, audio),
		onError: (error) => setRecordError(error.message),
	});

	const draftVisit = () =>
		void agent.queueOrSendMessage({
			text: scribeRequestMessage({ encounterId, language: chosenLanguage, transcript }),
		});

	return (
		<div className={styles.panel} data-testid='scribe-panel'>
			<RecordingConsentStep
				encounterId={encounterId}
				onConsentChange={() => setRecordError(undefined)}
				recorder={recorder}
				onRecordError={setRecordError}
			/>
			{recordError && <ErrorMessage message={recordError} />}
			<section className={styles.step} aria-labelledby='scribe-transcript'>
				<div className={styles.stepHeader}>
					<h3 id='scribe-transcript' className={styles.stepTitle}>
						Transcript or dictation
					</h3>
					<span className={styles.muted}>
						{transcript.length.toLocaleString()} / {SCRIBE_TRANSCRIPT_MAX_LENGTH.toLocaleString()}
					</span>
				</div>
				<Textarea
					aria-labelledby='scribe-transcript'
					rows={8}
					value={transcript}
					placeholder='Record the consult, or type or paste the dictation: complaint, history, findings, assessment and plan. English, Taglish, Filipino or Cebuano.'
					onChange={(event) => update(event.target.value)}
				/>
				<div className={styles.row}>
					<label className={styles.label}>
						Patient summary in
						<select
							className={styles.select}
							value={chosenLanguage}
							onChange={(event) => setLanguage(event.target.value as ScribeLanguage)}
						>
							{SCRIBE_LANGUAGES.map((code) => (
								<option key={code} value={code}>
									{SCRIBE_LANGUAGE_LABELS[code]}
								</option>
							))}
						</select>
					</label>
					<div className={`${styles.actions} ${styles.push}`}>
						{transcript && (
							<Button
								variant='ghost-muted'
								size='sm'
								onClick={() => update('')}
								disabled={agent.isRunning}
							>
								Clear
							</Button>
						)}
						<Button
							size='sm'
							onClick={draftVisit}
							disabled={!transcript.trim() || agent.isRunning || recorder.isRecording}
						>
							<Sparkles />
							{draft ? 'Draft again with Wise' : 'Draft with Wise'}
						</Button>
					</div>
				</div>
				<p className={styles.muted}>
					Wise drafts each part as a card below; nothing is saved until you confirm it. The request and
					Wise&apos;s reply also show in the patient&apos;s Wise chat.
				</p>
			</section>
			{agent.error && <ErrorMessage message={agent.error.message} />}
			{draft ? (
				<ScribeCards key={draft.toolCallId} toolPart={draft} record={record} />
			) : (
				agent.isRunning && <p className={styles.muted}>Wise is reading the transcript…</p>
			)}
		</div>
	);
}

/** Shown, with Record off, while the clinic's Transcription switch is off (the API refuses with TRANSCRIPTION_DISABLED). */
const TRANSCRIPTION_OFF_TEXT =
	'Transcription is off for this clinic. Turn it on in Settings → Clinic → Agent, or type the dictation.';

/**
 * Recording needs the patient's consent for this visit (a `patient_consents` row, PHOTO_VIDEO); the doctor reads the
 * text and records the answer. Without it, or while the clinic has transcription off (Settings → Clinic → Agent), the
 * record button stays off, and typing still works.
 */
function RecordingConsentStep({
	encounterId,
	recorder,
	onConsentChange,
	onRecordError,
}: {
	encounterId: string;
	recorder: ReturnType<typeof useTranscribe>;
	onConsentChange: () => void;
	onRecordError: (message: string | undefined) => void;
}) {
	const queryClient = useQueryClient();
	const consent = useQuery(scribeApi.scribe.consent.queryOptions({ encounterId }));
	const agentSettings = useQuery(clinicApi.clinic.getAgentSettings.queryOptions());
	const isTranscriptionOn = agentSettings.data?.transcribe?.enabled ?? false;
	const isTranscriptionOff = !!agentSettings.data && !isTranscriptionOn;
	const [asking, setAsking] = useState(false);
	const answer = useMutation(
		scribeApi.scribe.recordConsent.mutationOptions({
			onSuccess: () => {
				setAsking(false);
				onConsentChange();
				return queryClient.invalidateQueries(scribeApi.scribe.consent.pathFilter());
			},
		}),
	);
	const current: RecordingConsentFieldsFragment | null | undefined = consent.data;
	const isActive = !!current?.isActive;
	const showQuestion = !consent.isPending && (asking || !current);

	const toggleRecording = () => {
		onRecordError(undefined);
		recorder.toggle();
	};

	return (
		<section className={styles.step} aria-labelledby='scribe-recording'>
			<div className={styles.stepHeader}>
				<h3 id='scribe-recording' className={styles.stepTitle}>
					<Mic aria-hidden />
					Record the consult
				</h3>
				<ConsentStatus consent={current} isPending={consent.isPending} />
			</div>
			{consent.error && <ErrorMessage message={consent.error.message} />}
			{showQuestion ? (
				<div className={styles.cardBody} data-testid='scribe-consent-question'>
					<p className={styles.consentText}>{RECORDING_CONSENT_TEXT}</p>
					<div className={styles.actions}>
						{current && (
							<Button variant='ghost-muted' size='sm' onClick={() => setAsking(false)}>
								Not now
							</Button>
						)}
						<Button
							variant='outline'
							size='sm'
							disabled={answer.isPending}
							onClick={() => answer.mutate({ encounterId, granted: false })}
						>
							Patient declines
						</Button>
						<Button
							size='sm'
							disabled={answer.isPending}
							onClick={() => answer.mutate({ encounterId, granted: true })}
						>
							Patient agrees
						</Button>
					</div>
				</div>
			) : (
				<div className={styles.row}>
					<Button
						size='sm'
						variant={recorder.isRecording ? 'destructive' : 'outline'}
						disabled={
							recorder.isTranscribing || (!recorder.isRecording && (!isActive || !isTranscriptionOn))
						}
						onClick={toggleRecording}
						aria-pressed={recorder.isRecording}
					>
						{recorder.isRecording ? <Square /> : <Mic />}
						{recorder.isRecording ? 'Stop' : recorder.isTranscribing ? 'Transcribing…' : 'Record'}
					</Button>
					<span className={styles.muted} data-testid='scribe-recording-hint'>
						{isTranscriptionOff
							? TRANSCRIPTION_OFF_TEXT
							: isActive
								? recorder.isRecording
									? 'Recording… press Stop (or Escape) when the consult ends. The audio is not kept.'
									: 'The recording is turned into text below; the audio is not kept.'
								: 'Recording is off without the patient’s consent. Type the dictation instead.'}
					</span>
					<div className={`${styles.actions} ${styles.push}`}>
						{isActive ? (
							<Button
								variant='ghost-muted'
								size='sm'
								disabled={answer.isPending || recorder.isRecording}
								onClick={() => answer.mutate({ encounterId, granted: false })}
							>
								Withdraw consent
							</Button>
						) : (
							<Button variant='ghost-muted' size='sm' onClick={() => setAsking(true)}>
								Ask for consent
							</Button>
						)}
					</div>
				</div>
			)}
			{answer.error && <ErrorMessage message={answer.error.message} />}
		</section>
	);
}

function ConsentStatus({
	consent,
	isPending,
}: {
	consent: RecordingConsentFieldsFragment | null | undefined;
	isPending: boolean;
}) {
	if (isPending) {
		return null;
	}
	if (consent?.isActive) {
		return (
			<span className={styles.status} data-tone='ok' data-testid='scribe-consent-status'>
				<CircleCheck aria-hidden />
				Consent to record given
			</span>
		);
	}
	return (
		<span className={styles.status} data-tone='warn' data-testid='scribe-consent-status'>
			<CircleSlash aria-hidden />
			{consent ? 'Patient declined recording' : 'Consent not asked yet'}
		</span>
	);
}
