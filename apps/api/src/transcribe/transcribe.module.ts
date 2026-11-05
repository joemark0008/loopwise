import { Module } from '@nestjs/common';

import { AgentCoreModule } from '../agent/agent-core.module.js';
import { TranscribeController } from './transcribe.controller.js';
import { TranscribeResolver } from './transcribe.resolver.js';
import { TranscribeService } from './transcribe.service.js';

/**
 * Voice input: `POST /api/transcribe` and the transcription model catalogue. Exports `TranscribeService` for the AI
 * scribe's consent-checked recording (`clinical/scribe`).
 */
@Module({
	imports: [AgentCoreModule],
	controllers: [TranscribeController],
	providers: [TranscribeService, TranscribeResolver],
	exports: [TranscribeService],
})
export class TranscribeModule {}
