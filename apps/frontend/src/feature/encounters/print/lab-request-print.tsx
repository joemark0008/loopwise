import { skipToken, useQuery } from '@tanstack/react-query';
import { formatDay } from '../encounter-format';
import { PatientLines, PrintShell } from './print-shell';
import styles from './print.module.css';
import { encounterRecordApi } from '@/lib/encounter-record-api';
import { ordersApi } from '@/lib/orders-api';
import { patientApi } from '@/lib/patient-api';

/** The printable lab / imaging request of an encounter: its orders, diagnoses and the requesting doctor. */
export function LabRequestPrint({ encounterId }: { encounterId: string }) {
	const record = useQuery(encounterRecordApi.encounterRecord.get.queryOptions({ encounterId }));
	const orders = useQuery(ordersApi.order.forEncounter.queryOptions({ encounterId }));
	const items = (orders.data ?? []).flatMap((order) =>
		order.items.filter((item) => item.status !== 'CANCELLED').map((item) => ({ order, item })),
	);
	const patientId = record.data?.encounter.patientId;
	const patient = useQuery(patientApi.patient.get.queryOptions(patientId ? { id: patientId } : skipToken));
	const data = record.data;
	const diagnoses = data?.diagnoses.filter((diagnosis) => !diagnosis.voidedAt) ?? [];

	return (
		<PrintShell
			title='Laboratory request'
			state={{
				isPending: record.isPending || orders.isPending || (Boolean(patientId) && patient.isPending),
				error: record.error ?? orders.error ?? patient.error,
				isMissing: !data || !patient.data,
			}}
		>
			{data && patient.data && (
				<>
					<header className={styles.letterhead}>
						<span className={styles.facility}>{data.encounter.clinic?.name ?? 'Clinic'}</span>
					</header>
					<h1 className={styles.title}>LABORATORY / IMAGING REQUEST</h1>
					<PatientLines patient={patient.data} date={formatDay(data.encounter.startedAt.slice(0, 10))} />
					{diagnoses.length > 0 && (
						<p>
							Clinical impression:{' '}
							{diagnoses
								.map(
									(diagnosis) =>
										`${diagnosis.description}${diagnosis.icd10Code ? ` (${diagnosis.icd10Code})` : ''}`,
								)
								.join('; ')}
						</p>
					)}
					<table className={styles.table}>
						<thead>
							<tr>
								<th>Test</th>
								<th>LOINC</th>
								<th>Priority</th>
								<th>Order no.</th>
							</tr>
						</thead>
						<tbody>
							{items.map(({ order, item }) => (
								<tr key={item.id}>
									<td>{item.test.name}</td>
									<td>{item.test.loincCode ?? '—'}</td>
									<td>{order.priority}</td>
									<td>{order.orderNo}</td>
								</tr>
							))}
						</tbody>
					</table>
					<footer className={styles.signature}>
						<span className={styles.signatureLine}>
							{data.encounter.practitioner?.displayName ?? 'Requesting physician'}
						</span>
						<span className={styles.signatureDetail}>Requesting physician</span>
					</footer>
					<div className={styles.footer}>
						<span>Encounter {data.encounter.encounterNo}</span>
						<span>Synthetic demo data · Loopwise</span>
					</div>
				</>
			)}
		</PrintShell>
	);
}
