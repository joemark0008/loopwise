import { skipToken, useQuery } from '@tanstack/react-query';
import { formatDate, formatDay } from '../encounter-format';
import { Letterhead, PatientLines, PrintShell, SignatureBlock } from './print-shell';
import styles from './print.module.css';
import { patientName } from '@/feature/patients/patient-format';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { referralApi } from '@/lib/follow-up-api';
import { patientApi } from '@/lib/patient-api';

const URGENCY_LABELS: Record<string, string> = { ROUTINE: 'Routine', URGENT: 'Urgent', STAT: 'Emergency (STAT)' };

/**
 * The printable referral letter: the clinic letterhead, the patient, who it is to, the reason and urgency, the
 * clinical summary, the visit's current diagnoses and medicines (issued prescriptions, not voided), and the referring
 * doctor's signature with PRC and PTR. Printed with the browser (print or save as PDF); the read is audited as a print.
 */
export function ReferralLetterPrint({ referralId }: { referralId: string }) {
	const letter = useQuery(referralApi.letter.queryOptions({ id: referralId }));
	const referral = letter.data?.referral;
	const patient = useQuery(patientApi.patient.get.queryOptions(referral ? { id: referral.patientId } : skipToken));
	const record = useQuery(
		encounterRecordApi.encounterRecord.get.queryOptions(
			referral ? { encounterId: referral.encounterId } : skipToken,
		),
	);
	const diagnoses = record.data?.diagnoses.filter((diagnosis) => !diagnosis.voidedAt) ?? [];
	const medicines =
		record.data?.prescriptions
			.filter((rx) => rx.documentStatus === 'ISSUED' && !rx.voidedAt)
			.flatMap((rx) => rx.items) ?? [];
	const to = referral
		? referral.isInternal
			? [referral.toPractitioner?.displayName, referral.specialty].filter(Boolean).join(', ')
			: [referral.toExternalDoctor, referral.toFacility, referral.specialty].filter(Boolean).join(', ')
		: '';

	return (
		<PrintShell
			title={referral ? `Referral letter, ${referral.patientName}` : 'Referral letter'}
			state={{
				isPending: letter.isPending || (Boolean(referral) && (patient.isPending || record.isPending)),
				error: letter.error ?? patient.error ?? record.error,
				isMissing: !letter.data || !patient.data,
			}}
			watermark={referral?.status === 'CANCELLED' ? 'Cancelled' : null}
		>
			{letter.data && referral && patient.data && (
				<>
					<Letterhead signatory={letter.data.signatory} />
					<h1 className={styles.title}>REFERRAL</h1>
					<PatientLines patient={patient.data} date={formatDate(referral.referredAt)} />
					<div className={styles.body} data-testid='referral-letter'>
						<p>
							<strong>To:</strong> {to || 'Attending physician'}
						</p>
						<p>
							<strong>Urgency:</strong> {URGENCY_LABELS[referral.urgency] ?? referral.urgency}
						</p>
						<p>Dear colleague,</p>
						<p>
							May I refer <strong>{patientName(patient.data)}</strong> to you for: {referral.reason}
						</p>
						{referral.clinicalSummary && (
							<p>
								<strong>Clinical summary:</strong> {referral.clinicalSummary}
							</p>
						)}
						<div>
							<strong>Current diagnoses</strong>
							{diagnoses.length === 0 ? (
								<p>None recorded on this visit.</p>
							) : (
								<ul>
									{diagnoses.map((diagnosis) => (
										<li key={diagnosis.id}>
											{diagnosis.icd10Code && `${diagnosis.icd10Code} `}
											{diagnosis.description}
											{diagnosis.type !== 'PRIMARY' && ` (${diagnosis.type.toLowerCase()})`}
										</li>
									))}
								</ul>
							)}
						</div>
						<div>
							<strong>Current medicines</strong>
							{medicines.length === 0 ? (
								<p>None prescribed on this visit.</p>
							) : (
								<ul>
									{medicines.map((item) => (
										<li key={item.id}>
											{item.genericName}
											{item.brandName && ` (${item.brandName})`}
											{item.strength && ` ${item.strength}`}
											{item.sig && `: ${item.sig}`}
										</li>
									))}
								</ul>
							)}
						</div>
						<p>
							Visit {referral.encounterNo}
							{record.data && ` on ${formatDay(record.data.encounter.startedAt.slice(0, 10))}`}. Thank you
							for seeing this patient; I would appreciate your findings and recommendations.
						</p>
					</div>
					<SignatureBlock signatory={letter.data.signatory} />
					<div className={styles.footer}>
						<span>Referral · {referral.encounterNo}</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
