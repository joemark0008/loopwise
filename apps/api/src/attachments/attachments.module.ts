import { Module, type OnApplicationShutdown } from '@nestjs/common';

import { ProjectsCoreModule } from '../projects/projects-core.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { ImageRepository } from './image.repository.js';
import { terminateOcr } from './ocr.js';
import { StorageResolver } from './storage.resolver.js';

/**
 * Message attachments (Phase 2d): `POST /api/attachments` into the user's permanent storage (`storage/`, module-level
 * like upstream's), the `storage*` queries, and the `message_image` repository the agent reads images through. The OCR
 * worker that reads scanned PDFs (`ocr.ts`) is module-level too; it is stopped on shutdown.
 */
@Module({
	imports: [ProjectsCoreModule],
	controllers: [AttachmentsController],
	providers: [AttachmentsService, ImageRepository, StorageResolver],
	exports: [AttachmentsService, ImageRepository],
})
export class AttachmentsModule implements OnApplicationShutdown {
	async onApplicationShutdown(): Promise<void> {
		await terminateOcr();
	}
}
