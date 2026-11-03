import { Module } from '@nestjs/common';

import { AgentModule } from '../agent/agent.module.js';
import { TranscribeController } from './transcribe.controller.js';
import { TranscribeResolver } from './transcribe.resolver.js';
import { TranscribeService } from './transcribe.service.js';

/** Voice input: `POST /api/transcribe` and the transcription model catalogue. */
@Module({
	imports: [AgentModule],
	controllers: [TranscribeController],
	providers: [TranscribeService, TranscribeResolver],
})
export class TranscribeModule {}
