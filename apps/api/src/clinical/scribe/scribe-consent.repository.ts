import { Injectable } from '@nestjs/common';

import type { ConsentType, PatientConsent, Prisma } from '../../generated/prisma/client.js';
import type { ClinicalTx } from '../rls/clinical-db.service.js';

/** Visit-specific consents (`patient_consents` with `encounter_id`), on the caller's `asUser` transaction. */
@Injectable()
export class ScribeConsentRepository {
	/** The latest consent of `type` recorded for the visit: it is the one that counts. */
	findLatest(tx: ClinicalTx, encounterId: string, type: ConsentType): Promise<PatientConsent | null> {
		return tx.patientConsent.findFirst({
			where: { encounterId, type },
			orderBy: [{ signedAt: 'desc' }, { id: 'desc' }],
		});
	}

	create(tx: ClinicalTx, data: Prisma.PatientConsentUncheckedCreateInput): Promise<PatientConsent> {
		return tx.patientConsent.create({ data });
	}
}
