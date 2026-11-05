import { skipToken, useQuery } from '@tanstack/react-query';
import { formatDay, medicineName, quantityLabel } from '../encounter-format';
import { documentWatermark, Letterhead, PatientLines, PrintShell, SignatureBlock } from './print-shell';
import styles from './print.module.css';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { patientApi } from '@/lib/patient-api';

/**
 * The printable prescription: letterhead, patient, ℞ items (generic first, RA 6675), prescriber with PRC, PTR and, for a
 * dangerous drug, S2 (RA 9165), and the verification code a pharmacy checks.
 */
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
			title={rx ? `Prescription ${rx.rxNo}` : 'Prescription'}
			state={{
				isPending: prescription.isPending || (Boolean(patientId) && patient.isPending),
				error: prescription.error ?? patient.error,
				isMissing: !rx || !patient.data,
			}}
			watermark={
				rx ? documentWatermark({ documentStatus: rx.documentStatus, voided: rx.voidedAt !== null }) : null
			}
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
												? `${allergy.allergen} (${allergy.reaction})`
												: allergy.allergen,
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
									{medicineName(item)} &nbsp;{quantityLabel(item)}
								</div>
								<div>Sig: {item.sig}</div>
							</li>
						))}
					</ol>
					{rx.notes && <p className={styles.small}>{rx.notes}</p>}
					<SignatureBlock signatory={rx.signatory} withS2={rx.isDangerousDrug} />
					<div className={styles.footer}>
						<span>
							{rx.rxNo} · Verification {rx.verificationCode}
						</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
