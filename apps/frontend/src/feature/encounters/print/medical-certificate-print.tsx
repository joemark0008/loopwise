import { skipToken, useQuery } from '@tanstack/react-query';
import { restUntil } from '@quarry/shared/medical-certificate';
import { fitnessLabel, formatDay } from '../encounter-format';
import { Letterhead, PatientLines, PrintShell, SignatureBlock, watermarkFor } from './print-shell';
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
			title={mc?.certificateNumber ? `Medical certificate ${mc.certificateNumber}` : 'Medical certificate'}
			state={{
				isPending: certificate.isPending || (Boolean(patientId) && patient.isPending),
				error: certificate.error ?? patient.error,
				isMissing: !mc || !patient.data,
			}}
			watermark={mc ? watermarkFor(mc.status) : null}
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
						<p>
							{fitnessLabel(mc.fitness)}.
							{mc.restFrom && mc.restDays && (
								<>
									{' '}
									The patient is advised to rest for {mc.restDays} day
									{mc.restDays === 1 ? '' : 's'}, from {formatDay(mc.restFrom)} to{' '}
									{formatDay(restUntil(mc.restFrom, mc.restDays))}.
								</>
							)}
						</p>
						{mc.remarks && <p>Remarks: {mc.remarks}</p>}
						<p>
							This certificate is issued upon request
							{mc.purpose ? ` for ${mc.purpose} purposes` : ''}, and not for medico-legal use.
						</p>
					</div>
					<SignatureBlock signatory={mc.signatory} />
					<div className={styles.footer}>
						<span>{mc.certificateNumber ?? 'Not issued'}</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
