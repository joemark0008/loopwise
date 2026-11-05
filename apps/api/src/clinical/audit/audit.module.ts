import { Module } from '@nestjs/common';

import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

/** The audit trail of clinical views and actions (DESIGN.md §8.6): import it and inject `AuditService`. */
@Module({
	imports: [ClinicalDbModule],
	providers: [AuditRepository, AuditService],
	exports: [AuditService],
})
export class AuditModule {}
