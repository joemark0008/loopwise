import { skipToken, useQuery } from '@tanstack/react-query';
import { fitnessLabel, formatDay } from '../encounter-format';
import { documentWatermark, Letterhead, PatientLines, PrintShell, SignatureBlock } from './print-shell';
import styles from './print.module.css';
import { ageOf, patientName } from '@/feature/patients/patient-format';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { patientApi } from '@/lib/patient-api';

/** The printable medical certificate: diagnosis, fitness to work and rest, signed with PRC and PTR. */
export function MedicalCertificatePrint({ certificateId }: { certificateId: string }) {
	const certificate = useQuery(
		encounterRecordApi.encounterRecord.certificatePrint.queryOptions({ id: certificateId }),
	);
	const patientId = certificate.data?.patientId;
	const patient = useQuery(patientApi.patient.get.queryOptions(patientId ? { id: patientId } : skipToken));
	const mc = certificate.data;
	const date = (mc?.issuedAt ?? mc?.createdAt ?? new Date().toISOString()).slice(0, 10);

	return (
		<PrintShell
			title={mc ? `Medical certificate ${mc.certNo}` : 'Medical certificate'}
			state={{
				isPending: certificate.isPending || (Boolean(patientId) && patient.isPending),
				error: certificate.error ?? patient.error,
				isMissing: !mc || !patient.data,
			}}
			watermark={mc ? documentWatermark({ documentStatus: mc.documentStatus, voided: mc.isVoid }) : null}
		>
			{mc && patient.data && mc.signatory && (
				<>
					<Letterhead signatory={mc.signatory} />
					<h1 className={styles.title}>MEDICAL CERTIFICATE</h1>
					<PatientLines patient={patient.data} date={formatDay(date)} />
					<div className={styles.body}>
						<p>To whom it may concern:</p>
						<p>
							This is to certify that <strong>{patientName(patient.data)}</strong>,{' '}
							{ageOf(patient.data.birthDate)} years old, was examined on {formatDay(mc.examinedOn)} and
							was found to have:
						</p>
						<p>
							<strong>{mc.diagnosisText}</strong>
						</p>
						{mc.findings && <p>Findings: {mc.findings}</p>}
						<p>
							{fitnessLabel(mc.isFitToWork) && `${fitnessLabel(mc.isFitToWork)}.`}
							{mc.restFrom && mc.restDays && mc.restTo && (
								<>
									{' '}
									The patient is advised to rest for {mc.restDays} day
									{mc.restDays === 1 ? '' : 's'}, from {formatDay(mc.restFrom)} to{' '}
									{formatDay(mc.restTo)}.
								</>
							)}
						</p>
						{mc.recommendation && <p>Recommendation: {mc.recommendation}</p>}
						{mc.peClassification && <p>Classification: {mc.peClassification}</p>}
						<p>
							This certificate is issued upon request
							{mc.purpose ? ` for ${mc.purpose} purposes` : ''}, and not for medico-legal use.
						</p>
					</div>
					<SignatureBlock signatory={mc.signatory} />
					<div className={styles.footer}>
						<span>
							{mc.certNo} · Verification {mc.verificationCode}
						</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
