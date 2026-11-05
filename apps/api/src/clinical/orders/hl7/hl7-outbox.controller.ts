import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import { CurrentFacility } from '../../../common/decorators/current.decorator.js';
import { FacilityKey } from '../../../facility-keys/facility-key.guard.js';
import type { Organization } from '../../../generated/prisma/client.js';
import { OutboxAckDto } from './dto/outbox-ack.dto.js';
import { Hl7OutboxService, type OutboxAckResult, type OutboxMessage } from './hl7-outbox.service.js';

/**
 * The edge connector's outbound queue (DESIGN.md §9), authenticated by the facility key: it pulls the pending ORM
 * messages for its facility and posts the lab system's ACK for each.
 */
@Controller('api/hl7/outbox')
export class Hl7OutboxController {
	constructor(private readonly outbox: Hl7OutboxService) {}

	@FacilityKey()
	@Get()
	pending(@CurrentFacility() facility: Organization, @Query('limit') limit?: string): Promise<OutboxMessage[]> {
		return this.outbox.pending(facility.id, limit ? Number(limit) : undefined);
	}

	@FacilityKey()
	@Post(':id/ack')
	@HttpCode(200)
	ack(
		@CurrentFacility() facility: Organization,
		@Param('id', new ParseUUIDPipe()) id: string,
		@Body() body: OutboxAckDto,
	): Promise<OutboxAckResult> {
		return this.outbox.ack(facility.id, id, body.code, body.ack ?? null);
	}
}
