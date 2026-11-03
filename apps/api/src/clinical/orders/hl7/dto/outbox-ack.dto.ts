import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { ACK_CODES, type AckCode } from '../hl7-outbox.service.js';

/** `POST /api/hl7/outbox/:id/ack`: the lab system's MSA-1 and, for the record, the raw ACK message. */
export class OutboxAckDto {
	@IsIn(ACK_CODES)
	code: AckCode;

	@IsOptional()
	@IsString()
	@MaxLength(65_536)
	ack?: string | null;
}
