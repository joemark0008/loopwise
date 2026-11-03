import { Injectable } from '@nestjs/common';

import type { Hl7Message, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** The HL7 ingest log (`hl7_message`): system data, never read through the app role. */
@Injectable()
export class Hl7MessageRepository {
	constructor(private readonly prisma: PrismaService) {}

	findByControlId(orgId: string, controlId: string): Promise<Hl7Message | null> {
		return this.prisma.hl7Message.findUnique({ where: { orgId_controlId: { orgId, controlId } } });
	}

	create(data: Prisma.Hl7MessageUncheckedCreateInput, tx: Tx = this.prisma): Promise<Hl7Message> {
		return tx.hl7Message.create({ data });
	}
}
