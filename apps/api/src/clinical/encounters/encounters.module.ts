import { Module } from '@nestjs/common';

import { ChatsCoreModule } from '../../chats/chats-core.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DocumentSequencesModule } from '../clinics/document-sequences/document-sequences.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { PractitionersModule } from '../practitioners/practitioners.module.js';
import { ReferenceModule } from '../reference/reference.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalsModule } from '../wise-proposals/wise-proposals.module.js';
import { EncounterRepository } from './encounter.repository.js';
import { EncounterService } from './encounter.service.js';
import { EncounterCardService } from './encounter-card.service.js';
import { EncounterDiagnosisService } from './encounter-diagnosis.service.js';
import { EncounterNoteService } from './encounter-note.service.js';
import { ENCOUNTER_NOTE_READER } from './encounter-note-reader.token.js';
import { EncounterRecordRepository } from './encounter-record.repository.js';
import { EncounterRecordResolver } from './encounter-record.resolver.js';
import { EncounterRecordService } from './encounter-record.service.js';
import { EncountersResolver } from './encounters.resolver.js';
import { VitalSignsService } from './vital-signs.service.js';

/**
 * Encounters (DESIGN.md §5): the visit hub (create, status transitions, the clinic's queue) and its record (note,
 * vitals, diagnoses). Exports `EncounterService` (`requireWritable` / `findReadable`) and `EncounterCardService` for
 * the modules that add to a visit's record (prescriptions, documents, diagnostics, billing).
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		DocumentSequencesModule,
		ReferenceModule,
		PatientsModule,
		PractitionersModule,
		ChatsCoreModule,
		WiseProposalsModule,
	],
	providers: [
		EncountersResolver,
		EncounterRecordResolver,
		EncounterService,
		EncounterCardService,
		EncounterNoteService,
		VitalSignsService,
		EncounterDiagnosisService,
		EncounterRecordService,
		EncounterRepository,
		EncounterRecordRepository,
		{ provide: ENCOUNTER_NOTE_READER, useExisting: EncounterNoteService },
	],
	exports: [EncounterService, EncounterCardService, ENCOUNTER_NOTE_READER],
})
export class EncountersModule {}
