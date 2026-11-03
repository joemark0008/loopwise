import { skipToken, useQuery } from '@tanstack/react-query';
import { formatDay, medicineName, sig } from '../encounter-format';
import { Letterhead, PatientLines, PrintShell, SignatureBlock, watermarkFor } from './print-shell';
import styles from './print.module.css';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { patientApi } from '@/lib/patient-api';

/** The printable prescription: letterhead, patient, ℞ items (generic first), prescriber with PRC and PTR. */
export function PrescriptionPrint({ prescriptionId }: { prescriptionId: string }) {
	const prescription = useQuery(
		encounterRecordApi.encounterRecord.prescriptionPrint.queryOptions({ id: prescriptionId }),
	);
	const patientId = prescription.data?.patientId;
	const patient = useQuery(patientApi.patient.get.queryOptions(patientId ? { id: patientId } : skipToken));
	// The pharmacist checks allergies against the medicines: they print with them.
	const allergies = useQuery(
		encounterRecordApi.encounterRecord.allergies.queryOptions(patientId ? { patientId } : skipToken),
	);
	const rx = prescription.data;
	const date = (rx?.issuedAt ?? rx?.createdAt ?? new Date().toISOString()).slice(0, 10);

	return (
		<PrintShell
			title={rx?.rxNumber ? `Prescription ${rx.rxNumber}` : 'Prescription'}
			state={{
				isPending: prescription.isPending || (Boolean(patientId) && patient.isPending),
				error: prescription.error ?? patient.error,
				isMissing: !rx || !patient.data,
			}}
			watermark={rx ? watermarkFor(rx.status) : null}
		>
			{rx && patient.data && rx.signatory && (
				<>
					<Letterhead signatory={rx.signatory} />
					<PatientLines patient={patient.data} date={formatDay(date)} />
					<p className={styles.allergyLine}>
						<strong>Allergies:</strong>{' '}
						{allergies.data === undefined
							? '…'
							: allergies.data.length === 0
								? 'not recorded'
								: allergies.data
										.map((allergy) =>
											allergy.reaction
												? `${allergy.substance} (${allergy.reaction})`
												: allergy.substance,
										)
										.join(', ')}
					</p>
					<span className={styles.rxSymbol} aria-label='Prescription'>
						℞
					</span>
					<ol className={styles.items}>
						{rx.items.map((item) => (
							<li key={item.id}>
								<div className={styles.itemName}>
									{medicineName(item)} &nbsp;#{item.quantity}
									{item.quantityUnit && ` ${item.quantityUnit}`}
								</div>
								<div>Sig: {sig(item)}</div>
								{item.instructions && <div className={styles.small}>{item.instructions}</div>}
								{item.refills > 0 && <div className={styles.small}>Refills: {item.refills}</div>}
							</li>
						))}
					</ol>
					{rx.notes && <p className={styles.small}>{rx.notes}</p>}
					<SignatureBlock signatory={rx.signatory} />
					<div className={styles.footer}>
						<span>{rx.rxNumber ?? 'Not issued'}</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
