import type { UserRole } from '@loopwise/shared/types';
import { Controller, Get, Head, HttpCode, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import type { AuthUser } from '../auth/auth.service.js';
import { ClinicAccess } from '../common/decorators/access.decorator.js';
import { CurrentClinic, CurrentUser, CurrentUserRole } from '../common/decorators/current.decorator.js';
import type { Clinic } from '../generated/prisma/client.js';
import { AttachmentsService, type UploadedAttachment, type UploadedFile } from './attachments.service.js';

/** Upstream's multipart limit (`app.register(multipart, { limits: { fileSize: 100 MB } })`). */
const MULTIPART_MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Port of upstream `routes/attachment.ts` (`/api/attachments`). The upload takes the first file of the multipart
 * body, whatever its field name, as upstream's `request.file()` does.
 */
@Controller('api/attachments')
export class AttachmentsController {
	constructor(private readonly attachments: AttachmentsService) {}

	@ClinicAccess()
	@Post()
	@HttpCode(200)
	@UseInterceptors(
		AnyFilesInterceptor({ limits: { fileSize: MULTIPART_MAX_FILE_SIZE }, defParamCharset: 'utf8' } as never),
	)
	upload(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@CurrentUserRole() userRole: UserRole,
		@UploadedFiles() files: UploadedFile[] | undefined,
	): Promise<UploadedAttachment> {
		return this.attachments.upload(user.id, clinic.id, userRole, files?.[0]);
	}

	/** Registered before the `GET` handler, which Express would otherwise also run for `HEAD`. */
	@ClinicAccess()
	@Head('file')
	async inspect(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Query('path') path: string | undefined,
		@Res() response: Response,
	): Promise<void> {
		const file = await this.attachments.getFile(user.id, clinic.id, path ?? '', false);
		setFileHeaders(response, file).setHeader('Content-Length', file.size);
		response.end();
	}

	@ClinicAccess()
	@Get('file')
	async download(
		@CurrentUser() user: AuthUser,
		@CurrentClinic() clinic: Clinic,
		@Query('path') path: string | undefined,
		@Res() response: Response,
	): Promise<void> {
		const file = await this.attachments.getFile(user.id, clinic.id, path ?? '', true);
		setFileHeaders(response, file).send(file.data);
	}
}

function setFileHeaders(response: Response, file: { fileName: string; mediaType: string }): Response {
	return (
		response
			.setHeader('Content-Type', file.mediaType)
			// Always a download: an uploaded .html rendered on loopwise's own origin would run as first-party script.
			.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
			.setHeader('X-Content-Type-Options', 'nosniff')
			.setHeader('Cache-Control', 'private, max-age=3600') as Response
	);
}
