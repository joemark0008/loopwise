import { Module } from '@nestjs/common';

import { DocumentSequenceRepository } from './document-sequence.repository.js';
import { DocumentSequenceService } from './document-sequence.service.js';

/** Per-clinic document numbering: import it and inject `DocumentSequenceService`. */
@Module({
	providers: [DocumentSequenceRepository, DocumentSequenceService],
	exports: [DocumentSequenceService],
})
export class DocumentSequencesModule {}
