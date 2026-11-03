import { AllergyChips } from './allergy-chips';
import styles from './clinical.module.css';
import type { ReactNode } from 'react';
import type { AllergyFieldsFragment, PatientFieldsFragment } from '@/graphql/generated/graphql';
import { formatDay } from '@/feature/encounters/encounter-format';
import { ageLabel, languageLabel, patientName } from '@/feature/patients/patient-format';

/**
 * Who this is, on every page of the patient, in one compact row: name, age and sex, identifiers and, always in view,
 * allergies. The patient layout keeps it above the scrolling page; on a phone it keeps the name, age and allergies.
 */
export function PatientBanner({
	patient,
	allergies,
	onAddAllergy,
	actions,
}: {
	patient: PatientFieldsFragment;
	allergies: AllergyFieldsFragment[] | undefined;
	onAddAllergy?: () => void;
	actions?: ReactNode;
}) {
	return (
		<section className={styles.banner} aria-label='Patient'>
			<h1 className={styles.bannerName}>
				<span data-testid='patient-name'>{patientName(patient)}</span>
				<span className={styles.bannerAge}>{ageLabel(patient.birthDate, patient.sex)}</span>
			</h1>
			<p className={styles.bannerMeta}>
				<span>
					Born <strong>{formatDay(patient.birthDate)}</strong>
				</span>
				{patient.identifiers.map((identifier) => (
					<span key={`${identifier.system}-${identifier.value}`}>
						{identifier.system} <strong>{identifier.value}</strong>
					</span>
				))}
				<span>{languageLabel(patient.preferredLanguage)}</span>
				{!patient.consentAt && <span>No consent recorded</span>}
			</p>
			{allergies && <AllergyChips allergies={allergies} onAdd={onAddAllergy} />}
			{actions && <div className={styles.bannerActions}>{actions}</div>}
		</section>
	);
}
