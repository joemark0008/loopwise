import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';

import { CurrentFacility } from '../common/decorators/current.decorator.js';
import { FacilityKey } from '../facility-keys/facility-key.guard.js';
import type { Organization } from '../generated/prisma/client.js';
import { Hl7IngestService } from './hl7-ingest.service.js';

/**
 * `POST /api/hl7/messages` — the contract shared with the edge connector (DESIGN.md §9):
 * - `Authorization: Bearer <facility key>`; 401 for a missing, unknown or revoked key.
 * - Body `text/plain`: one HL7 v2 message, segments separated by `\r`, MLLP framing already stripped.
 * - 200 `text/plain`: an HL7 ACK (MSH + MSA with AA / AE / AR and the original MSH-10). AE and AR mean "do not
 *   retry"; only 5xx (transient) should be retried. Idempotent per (facility, MSH-10).
 */
@Controller('api/hl7')
export class Hl7IngestController {
	constructor(private readonly ingest: Hl7IngestService) {}

	@FacilityKey()
	@Post('messages')
	@HttpCode(200)
	@Header('Content-Type', 'text/plain; charset=utf-8')
	receive(@CurrentFacility() facility: Organization, @Body() body: unknown): Promise<string> {
		return this.ingest.receive(facility, typeof body === 'string' ? body : '');
	}
}
