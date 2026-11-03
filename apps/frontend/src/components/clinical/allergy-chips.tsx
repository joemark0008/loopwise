import { OctagonAlert, Plus } from 'lucide-react';
import styles from './clinical.module.css';
import { ClinicalFlag } from './clinical-flag';
import type { AllergyFieldsFragment } from '@/graphql/generated/graphql';
import { Button } from '@/components/ui/button';

/**
 * The patient's allergies, always in view where medicines are decided. A recorded allergy is critical; an empty list
 * is "not recorded" (unknown, so a warning), never a reassuring "none".
 */
export function AllergyChips({
	allergies,
	onAdd,
}: {
	allergies: Pick<AllergyFieldsFragment, 'id' | 'substance' | 'severity' | 'reaction'>[];
	onAdd?: () => void;
}) {
	return (
		<div className={styles.chipRow} data-testid='allergies'>
			<span className={styles.chipLabel}>Allergies</span>
			{allergies.length === 0 ? (
				<ClinicalFlag tone='abnormal'>Not recorded</ClinicalFlag>
			) : (
				allergies.map((allergy) => (
					<ClinicalFlag
						key={allergy.id}
						tone='critical'
						icon={OctagonAlert}
						title={allergy.reaction ?? undefined}
					>
						{allergy.substance}
						{allergy.severity && ` · ${allergy.severity}`}
						{allergy.reaction && <span className={styles.allergyReaction}>({allergy.reaction})</span>}
					</ClinicalFlag>
				))
			)}
			{onAdd && (
				<Button size='sm' variant='ghost' onClick={onAdd}>
					<Plus />
					Add allergy
				</Button>
			)}
		</div>
	);
}
