import { registerEnumType } from '@nestjs/graphql';

import { DiagnosisType, Disposition, EncounterStatus, EncounterType } from '../../generated/prisma/enums.js';

registerEnumType(EncounterType, { name: 'EncounterType' });
registerEnumType(EncounterStatus, {
	name: 'EncounterStatus',
	description: 'OPEN (checked in, triage) → IN_PROGRESS (with the doctor) → FOR_BILLING → COMPLETED; or CANCELLED.',
});
registerEnumType(Disposition, { name: 'Disposition' });
registerEnumType(DiagnosisType, { name: 'DiagnosisType' });

export { DiagnosisType, Disposition, EncounterStatus, EncounterType };
