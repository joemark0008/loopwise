import { Module } from '@nestjs/common';

import { ChatsCoreModule } from '../../chats/chats-core.module.js';
import { OrganizationsModule } from '../../organizations/organizations.module.js';
import { UsersModule } from '../../users/users.module.js';
import { ClinicalAuditModule } from '../audit/clinical-audit.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { EncounterRepository } from './encounter.repository.js';
import { EncounterService } from './encounter.service.js';
import { ENCOUNTER_NOTE_READER } from './encounter-note-reader.token.js';
import { EncounterRecordRepository } from './encounter-record.repository.js';
import { EncounterRecordResolver } from './encounter-record.resolver.js';
import { EncounterRecordService } from './encounter-record.service.js';
import { EncountersResolver } from './encounters.resolver.js';

/**
 * A patient's encounters (DESIGN.md §7): the chart's visit list, what `propose_encounter` confirms into, and each
 * encounter's record (note, vitals, diagnoses, allergies; the documents and orders have their own modules).
 */
@Module({
	imports: [
		ClinicalDbModule,
		ClinicalAuditModule,
		OrganizationsModule,
		ChatsCoreModule,
		UsersModule,
		PatientsModule,
		WiseProposalsModule,
	],
	providers: [
		EncountersResolver,
		EncounterService,
		EncounterRepository,
		EncounterRecordResolver,
		EncounterRecordService,
		EncounterRecordRepository,
		{ provide: ENCOUNTER_NOTE_READER, useExisting: EncounterRecordService },
	],
	exports: [EncounterService, EncounterRepository, ENCOUNTER_NOTE_READER],
})
export class EncountersModule {}
