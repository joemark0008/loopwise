import { Module } from '@nestjs/common';

import { ClinicalDbService } from './clinical-db.service.js';

/** The row-level security context of the clinical modules (DESIGN.md §8.2). */
@Module({
	providers: [ClinicalDbService],
	exports: [ClinicalDbService],
})
export class ClinicalDbModule {}
