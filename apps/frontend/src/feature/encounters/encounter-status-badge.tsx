import { ENCOUNTER_STATUS_LABELS } from '@loopwise/shared/encounter';
import type { EncounterStatus } from '@loopwise/shared/encounter';
import type { ClinicalTone } from '@/components/clinical/clinical-flag';
import { ClinicalFlag } from '@/components/clinical/clinical-flag';

const TONE: Record<EncounterStatus, ClinicalTone> = {
	OPEN: 'draft',
	IN_PROGRESS: 'info',
	FOR_BILLING: 'abnormal',
	COMPLETED: 'done',
	CANCELLED: 'void',
};

/** Where the visit stands: waiting, with the doctor, for billing, completed or cancelled. */
export function EncounterStatusBadge({ status }: { status: EncounterStatus }) {
	return <ClinicalFlag tone={TONE[status]}>{ENCOUNTER_STATUS_LABELS[status]}</ClinicalFlag>;
}
