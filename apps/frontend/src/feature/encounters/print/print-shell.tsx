import { Printer } from 'lucide-react';
import styles from './print.module.css';
import type { PatientFieldsFragment, SignatoryFieldsFragment } from '@/graphql/generated/graphql';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { ErrorMessage } from '@/components/ui/error-message';
import { Skeleton } from '@/components/ui/skeleton';
import { ageOf, patientName } from '@/feature/patients/patient-format';

/**
 * The page around a printable document: a toolbar (hidden when printing) and an A5-like sheet. "Save as PDF" is the
 * browser's print dialog. Drafts and voided documents carry a watermark.
 */
export function PrintShell({
	title,
	state,
	watermark,
	children,
}: {
	title: string;
	state: { isPending: boolean; error: Error | null; isMissing: boolean };
	watermark?: string | null;
	children?: ReactNode;
}) {
	let content: ReactNode = children;
	if (state.isPending) {
		content = <Skeleton />;
	} else if (state.error) {
		content = <ErrorMessage message={state.error.message} />;
	} else if (state.isMissing) {
		content = <Empty>This document is not in your care, or does not exist.</Empty>;
	}
	const ready = !state.isPending && !state.error && !state.isMissing;
	return (
		<div className={styles.printPage}>
			<div className={styles.toolbar}>
				<span className={styles.small}>{title}</span>
				<Button size='sm' onClick={() => window.print()} disabled={!ready}>
					<Printer />
					Print or save as PDF
				</Button>
			</div>
			<article className={styles.sheet} aria-label={title}>
				{ready && watermark && (
					<div className={styles.watermark} aria-hidden>
						{watermark}
					</div>
				)}
				{content}
			</article>
		</div>
	);
}

export function Letterhead({ signatory }: { signatory: SignatoryFieldsFragment }) {
	return (
		<header className={styles.letterhead}>
			<span className={styles.facility}>{signatory.facilityName}</span>
			{signatory.facilityAddress && <span className={styles.small}>{signatory.facilityAddress}</span>}
			{signatory.facilityPhone && <span className={styles.small}>Tel. {signatory.facilityPhone}</span>}
		</header>
	);
}

export function PatientLines({ patient, date }: { patient: PatientFieldsFragment; date: string }) {
	return (
		<dl className={styles.patientGrid}>
			<dt>Name</dt>
			<dd>{patientName(patient)}</dd>
			<dt>Patient no.</dt>
			<dd>{patient.patientNo}</dd>
			<dt>Date</dt>
			<dd>{date}</dd>
			<dt>Age / Sex</dt>
			<dd>
				{ageOf(patient.birthDate)} / {patient.sex === 'FEMALE' ? 'F' : 'M'}
			</dd>
			<dt>Birth date</dt>
			<dd>{patient.birthDate}</dd>
		</dl>
	);
}

/** The prescriber's signature lines: PRC and PTR, and the S2 license on a dangerous-drug Rx (RA 9165). */
export function SignatureBlock({
	signatory,
	withS2 = false,
}: {
	signatory: SignatoryFieldsFragment;
	withS2?: boolean;
}) {
	return (
		<footer className={styles.signature}>
			<span className={styles.signatureLine}>
				{signatory.name}
				{signatory.credentials && `, ${signatory.credentials}`}
			</span>
			<span className={styles.signatureDetail}>PRC Lic. No. {signatory.licenseNumber ?? '________'}</span>
			<span className={styles.signatureDetail}>PTR No. {signatory.ptrNumber ?? '________'}</span>
			{withS2 && (
				<span className={styles.signatureDetail}>S2 Lic. No. {signatory.s2LicenseNo ?? '________'}</span>
			)}
		</footer>
	);
}

/** "DRAFT — not valid" before issue, "VOID" after voiding. */
export function watermarkFor(status: 'draft' | 'issued' | 'voided') {
	return status === 'draft' ? 'Draft — not valid' : status === 'voided' ? 'Void' : null;
}

/** The watermark of a prescription or certificate (`documentStatus` and whether it is voided). */
export function documentWatermark(document: { documentStatus: 'DRAFT' | 'ISSUED'; voided: boolean }) {
	return watermarkFor(document.voided ? 'voided' : document.documentStatus === 'DRAFT' ? 'draft' : 'issued');
}
