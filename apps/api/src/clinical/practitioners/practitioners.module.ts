import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { PractitionerLoader } from './practitioner.loader.js';
import { PractitionerRepository } from './practitioner.repository.js';
import { PractitionerService } from './practitioner.service.js';
import { PractitionersResolver } from './practitioners.resolver.js';

/**
 * Practitioners (replaces the clinician profile): PRC license, PTR, S2, PhilHealth PAN and the clinics they hold clinic
 * in. Exports `PractitionerService` for the modules whose documents a practitioner signs.
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, GuardsModule],
	providers: [PractitionersResolver, PractitionerService, PractitionerRepository, PractitionerLoader],
	exports: [PractitionerService],
})
export class PractitionersModule {}
