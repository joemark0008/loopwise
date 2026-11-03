import { Module } from '@nestjs/common';

import { ClinicalAuditRepository } from './clinical-audit.repository.js';

/** The audit trail of clinical views and actions (DESIGN.md §10.6). */
@Module({ providers: [ClinicalAuditRepository], exports: [ClinicalAuditRepository] })
export class ClinicalAuditModule {}
