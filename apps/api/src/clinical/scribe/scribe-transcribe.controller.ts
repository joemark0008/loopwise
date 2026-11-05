import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import type { AuthUser } from '../../auth/auth.service.js';
import { ClinicAccess } from '../../common/decorators/access.decorator.js';
import { CurrentUser } from '../../common/decorators/current.decorator.js';
import { HandlerError } from '../../common/errors/handler-error.js';
import { ScribeTranscribeBodySchema } from './dto/scribe.input.js';
import { ScribeConsentService } from './scribe-consent.service.js';

/**
 * `POST /api/scribe/transcribe` (a REST upload, CLAUDE.md): one recording of a visit as base64 audio in, its text
 * out. Refused without the patient's recording consent for the visit; the audio is not kept.
 */
@Controller('api/scribe')
export class ScribeTranscribeController {
	constructor(private readonly consents: ScribeConsentService) {}

	@ClinicAccess()
	@Post('transcribe')
	@HttpCode(200)
	transcribe(@CurrentUser() user: AuthUser, @Body() rawBody: unknown): Promise<{ text: string }> {
		const parsed = ScribeTranscribeBodySchema.safeParse(rawBody);
		if (!parsed.success) {
			throw new HandlerError('BAD_REQUEST', parsed.error.issues.map((issue) => issue.message).join('; '));
		}
		return this.consents.transcribeVisit(user.id, parsed.data);
	}
}
