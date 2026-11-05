// The referral urgency is the diagnostics domain's `OrderPriority`, registered there once.
import '../diagnostics/models/diagnostic-enums.js';

import { registerEnumType } from '@nestjs/graphql';

import { CertificateType, OrderPriority, ReferralStatus } from '../../generated/prisma/enums.js';

registerEnumType(CertificateType, { name: 'CertificateType' });
registerEnumType(ReferralStatus, {
	name: 'ReferralStatus',
	description: 'SENT → ACCEPTED → COMPLETED, or DECLINED / CANCELLED (DRAFT unused for now).',
});

export { DocumentStatus } from './document-lifecycle.js';
export { CertificateType, OrderPriority, ReferralStatus };
