import { registerEnumType } from '@nestjs/graphql';

import { PrescriptionStatus } from '../../generated/prisma/enums.js';

registerEnumType(PrescriptionStatus, {
	name: 'PrescriptionStatus',
	description: 'Dispensing state: ACTIVE → PARTIALLY_DISPENSED → DISPENSED; CANCELLED when voided; EXPIRED.',
});

export { DocumentStatus } from '../documents/document-lifecycle.js';
export { PrescriptionStatus };
