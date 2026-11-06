import { Module } from '@nestjs/common';

import { GuardsModule } from '../../common/guards/guards.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { AppointmentRepository } from './appointments/appointment.repository.js';
import { AppointmentService } from './appointments/appointment.service.js';
import { AppointmentSlotService } from './appointments/appointment-slot.service.js';
import { AppointmentsResolver } from './appointments/appointments.resolver.js';
import { PRACTITIONER_AVAILABILITY } from './availability/practitioner-availability.js';
import { PractitionerScheduleAvailability } from './availability/practitioner-schedule-availability.js';
import { CheckInService } from './queue/check-in.service.js';
import { QueueRepository } from './queue/queue.repository.js';
import { QueueResolver } from './queue/queue.resolver.js';
import { QueueService } from './queue/queue.service.js';
import { VisitFlowService } from './queue/visit-flow.service.js';
import { VisitStatusSync } from './queue/visit-status-sync.service.js';
import { APPOINTMENT_NOTIFIER, LogAppointmentNotifier } from './reminders/appointment-notifier.js';
import { AppointmentReminderService } from './reminders/appointment-reminder.service.js';
import { SchedulingAccess } from './scheduling-access.js';
import { SCHEDULING_READER } from './scheduling-reader.token.js';
import { SchedulingWiseReader } from './scheduling-wise-reader.js';

/**
 * Scheduling (DESIGN.md §5.2, PLAN.md §4.2): appointments (`appointments/`: booking into a doctor's slots,
 * rescheduling, cancelling, no-shows), the clinic's queue (`queue/`: check-in opening the visit, the priority lane,
 * triage, the doctor's line, the cashier, the waiting-room board) and next-day reminders (`reminders/`). Slots come
 * from `PRACTITIONER_AVAILABILITY` (`PractitionerScheduleService` of clinic setup). The ticket and the booking follow
 * the visit both ways: queue moves through `VisitFlowService`, encounter-page moves through `VisitStatusSync` (a
 * listener of the encounters module's `EncounterStatusEvents`, so encounters never imports scheduling). Exports
 * `AppointmentService` (booking), `SchedulingAccess` (desk checks) and `SCHEDULING_READER` for Wise.
 */
@Module({
	imports: [ClinicalDbModule, AuditModule, GuardsModule, EncountersModule, PractitionersModule, WiseProposalsModule],
	providers: [
		SchedulingAccess,
		{ provide: PRACTITIONER_AVAILABILITY, useClass: PractitionerScheduleAvailability },
		AppointmentRepository,
		AppointmentSlotService,
		AppointmentService,
		AppointmentsResolver,
		QueueRepository,
		QueueService,
		CheckInService,
		VisitFlowService,
		VisitStatusSync,
		QueueResolver,
		{ provide: APPOINTMENT_NOTIFIER, useClass: LogAppointmentNotifier },
		AppointmentReminderService,
		SchedulingWiseReader,
		{ provide: SCHEDULING_READER, useExisting: SchedulingWiseReader },
	],
	exports: [AppointmentService, QueueService, SchedulingAccess, SCHEDULING_READER],
})
export class SchedulingModule {}
