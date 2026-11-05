import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { PractitionerLoader } from './practitioner.loader.js';
import { PractitionerRepository } from './practitioner.repository.js';
import { PractitionerService } from './practitioner.service.js';
import { PractitionersResolver } from './practitioners.resolver.js';
import { PractitionerScheduleRepository } from './schedules/practitioner-schedule.repository.js';
import { PractitionerScheduleResolver } from './schedules/practitioner-schedule.resolver.js';
import { PractitionerScheduleService } from './schedules/practitioner-schedule.service.js';

/**
 * Practitioners (replaces the clinician profile): PRC license, PTR, S2, PhilHealth PAN, the clinics they hold clinic
 * in, their weekly schedules and leaves. Exports `PractitionerService` for the modules whose documents a practitioner
 * signs, and `PractitionerScheduleService` (read-only: availability, leaves) for booking.
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, GuardsModule],
	providers: [
		PractitionersResolver,
		PractitionerService,
		PractitionerRepository,
		PractitionerLoader,
		PractitionerScheduleRepository,
		PractitionerScheduleService,
		PractitionerScheduleResolver,
	],
	exports: [PractitionerService, PractitionerScheduleService],
})
export class PractitionersModule {}
