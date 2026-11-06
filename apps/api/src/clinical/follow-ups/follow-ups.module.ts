import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { FollowUpRepository } from './follow-up.repository.js';
import { FollowUpService } from './follow-up.service.js';
import { FollowUpWiseReader } from './follow-up-wise-reader.js';
import { FollowUpsResolver } from './follow-ups.resolver.js';
import { FOLLOW_UPS_READER } from './follow-ups-reader.token.js';

/**
 * Follow-ups (DESIGN.md §6): the list of visits whose follow-up date is due, overdue or coming up, computed live from
 * `encounters.follow_up_date` and the patient's later visits and bookings (no job, no stored list). Booking one is
 * Scheduling's `bookAppointment` (its dialog, or Wise's `propose_appointment` card). Exports `FOLLOW_UPS_READER` for
 * Wise's `list_follow_ups` and `list_referrals`.
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, PractitionersModule, SchedulingModule, DocumentsModule],
	providers: [
		FollowUpRepository,
		FollowUpService,
		FollowUpsResolver,
		FollowUpWiseReader,
		{ provide: FOLLOW_UPS_READER, useExisting: FollowUpWiseReader },
	],
	exports: [FollowUpService, FOLLOW_UPS_READER],
})
export class FollowUpsModule {}
