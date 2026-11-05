import { Module } from '@nestjs/common';

import { AuditModule } from '../../audit/audit.module.js';
import { ClinicalDbModule } from '../../rls/clinical-db.module.js';
import { DocumentSequenceRepository } from './document-sequence.repository.js';
import { DocumentSequenceService } from './document-sequence.service.js';
import { DocumentSequenceSettingsResolver } from './document-sequence-settings.resolver.js';
import { DocumentSequenceSettingsService } from './document-sequence-settings.service.js';

/**
 * Per-clinic document numbering: import it and inject `DocumentSequenceService`. Also serves Settings → Clinic →
 * Numbering (`documentSequences`, `setDocumentSequence`).
 */
@Module({
	imports: [ClinicalDbModule, AuditModule],
	providers: [
		DocumentSequenceRepository,
		DocumentSequenceService,
		DocumentSequenceSettingsService,
		DocumentSequenceSettingsResolver,
	],
	exports: [DocumentSequenceService],
})
export class DocumentSequencesModule {}
