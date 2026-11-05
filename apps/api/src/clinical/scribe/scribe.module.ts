import { Module } from '@nestjs/common';

import { TranscribeModule } from '../../transcribe/transcribe.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { DiagnosticsModule } from '../diagnostics/diagnostics.module.js';
import { EncountersModule } from '../encounters/encounters.module.js';
import { PatientsModule } from '../patients/patients.module.js';
import { ReferenceModule } from '../reference/reference.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { ScribeResolver } from './scribe.resolver.js';
import { ScribeConsentRepository } from './scribe-consent.repository.js';
import { ScribeConsentService } from './scribe-consent.service.js';
import { SCRIBE_READER } from './scribe-reader.token.js';
import { ScribeTranscribeController } from './scribe-transcribe.controller.js';
import { ScribeWiseReader } from './scribe-wise-reader.js';

/**
 * The AI scribe (PLAN.md §4.3, DESIGN.md §7.5): recording consent per visit, consent-checked transcription, and the
 * read behind Wise's `propose_scribe_note` (`SCRIBE_READER`). It saves no clinical record itself: each part of a draft
 * is confirmed through its own module's mutation (encounters, prescriptions, diagnostics, documents).
 */
@Module({
	imports: [
		ClinicalDbModule,
		AuditModule,
		EncountersModule,
		PatientsModule,
		ReferenceModule,
		DiagnosticsModule,
		TranscribeModule,
	],
	controllers: [ScribeTranscribeController],
	providers: [
		ScribeResolver,
		ScribeConsentService,
		ScribeConsentRepository,
		ScribeWiseReader,
		{ provide: SCRIBE_READER, useExisting: ScribeWiseReader },
	],
	exports: [SCRIBE_READER],
})
export class ScribeModule {}
