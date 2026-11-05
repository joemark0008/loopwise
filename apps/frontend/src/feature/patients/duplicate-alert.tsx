import { Link } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import styles from './duplicate-alert.module.css';
import type { PatientDuplicateFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';

/**
 * Patients a registration may duplicate. An identifier match can't be registered again: the clinician opens or uses
 * the existing patient. A name, birth date and sex match may be someone else, so registering anyway stays possible.
 */
export function DuplicateAlert({
	duplicates,
	onUseExisting,
	onRegisterAnyway,
	isPending,
}: {
	duplicates: PatientDuplicateFieldsFragment[];
	onUseExisting: (patientId: string) => void;
	onRegisterAnyway?: () => void;
	isPending?: boolean;
}) {
	if (duplicates.length === 0) {
		return null;
	}
	const isBlocked = duplicates.some((duplicate) => duplicate.match === 'EXACT_IDENTIFIER');

	return (
		<div className={styles.duplicateAlert} role='alert' data-testid='duplicate-alert'>
			<div className={styles.duplicateAlertTitle}>
				<TriangleAlert />
				{isBlocked ? 'This patient is already registered' : 'Possible duplicate'}
			</div>
			<ul className={styles.duplicateAlertList}>
				{duplicates.map((duplicate) => (
					<li key={duplicate.patientId} className={styles.duplicateAlertItem}>
						<div className={styles.duplicateAlertWho}>
							<span className={styles.duplicateAlertName}>
								{duplicate.displayName}, born {duplicate.birthYear}
							</span>
							<span className={styles.duplicateAlertMeta}>Same {duplicate.matchedOn}</span>
						</div>
						{duplicate.visible ? (
							<Button variant='outline' size='sm' asChild>
								<Link to='/patients/$patientId' params={{ patientId: duplicate.patientId }}>
									Open
								</Link>
							</Button>
						) : (
							<Button
								variant='outline'
								size='sm'
								disabled={isPending}
								onClick={() => onUseExisting(duplicate.patientId)}
							>
								Use this patient
							</Button>
						)}
					</li>
				))}
			</ul>
			{!isBlocked && onRegisterAnyway && (
				<div className={styles.duplicateAlertFooter}>
					<span>Not the same person?</span>
					<Button variant='ghost-muted' size='sm' disabled={isPending} onClick={onRegisterAnyway}>
						Register as a new patient
					</Button>
				</div>
			)}
		</div>
	);
}
