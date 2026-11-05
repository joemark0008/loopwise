import { Module } from '@nestjs/common';

import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { ReferenceRepository } from './reference.repository.js';
import { ReferenceResolver } from './reference.resolver.js';
import { ReferenceService } from './reference.service.js';

/** Reference data (ICD-10, PSGC): lookups for the forms, and the checks other modules run against it. */
@Module({
	imports: [ClinicalDbModule],
	providers: [ReferenceResolver, ReferenceService, ReferenceRepository],
	exports: [ReferenceService],
})
export class ReferenceModule {}
