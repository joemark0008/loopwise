import { Injectable } from '@nestjs/common';

import type { Prisma, WiseProposalOutcome } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/**
 * Wise proposal outcomes, and the stored tool call a card answers. Chats aren't clinical data (they belong to their
 * author), so the tool call is read on `PrismaService`; outcomes are written in the caller's clinical transaction.
 */
@Injectable()
export class WiseProposalRepository {
	constructor(private readonly prisma: PrismaService) {}

	findToolCall(toolCallId: string) {
		return this.prisma.messagePart.findUnique({
			where: { toolCallId },
			select: {
				toolName: true,
				messageId: true,
				chatMessage: { select: { chatId: true, chat: { select: { userId: true, patientId: true } } } },
			},
		});
	}

	findOutcome(toolCallId: string): Promise<WiseProposalOutcome | null> {
		return this.prisma.wiseProposalOutcome.findUnique({ where: { toolCallId } });
	}

	listOutcomes(userId: string, chatId: string): Promise<WiseProposalOutcome[]> {
		return this.prisma.wiseProposalOutcome.findMany({ where: { userId, chatId }, orderBy: { at: 'asc' } });
	}

	insertOutcome(tx: Tx, outcome: Prisma.WiseProposalOutcomeUncheckedCreateInput): Promise<WiseProposalOutcome> {
		return tx.wiseProposalOutcome.create({ data: outcome });
	}
}
