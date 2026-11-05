import { displayChart, type displayMap } from '@loopwise/shared/tools';
import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { selectLatestDisplayChartTableFormats } from './chart-image.utils.js';

const DISPLAY_CHART_TOOL_TYPE = 'tool-display_chart';
const DISPLAY_MAP_TOOL_TYPE = 'tool-display_map';

/**
 * Port of upstream `queries/chart-image.ts`, `queries/display-map.queries.ts` and the `message_image` reads of
 * `queries/image.queries.ts`: rendered chart PNGs, the stored `display_chart` / `display_map` tool inputs, and
 * images attached to messages.
 */
@Injectable()
export class ChartRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Base64 PNG of a rendered chart (upstream `getChartById`), or null when there is none. */
	async getChartById(id: string): Promise<string | null> {
		const row = await this.prisma.chartImage.findUnique({ where: { id }, select: { data: true } });
		return row?.data ?? null;
	}

	async getDisplayConfigByToolCallId(toolCallId: string): Promise<displayChart.Input> {
		const part = await this.prisma.messagePart.findFirst({
			where: displayChartToolCall(toolCallId),
			select: { toolInput: true },
		});
		if (!part) {
			throw new HandlerError('NOT_FOUND', 'Visualization not found.');
		}
		return displayChart.InputSchema.parse(part.toolInput);
	}

	async saveChart(toolCallId: string, data: string): Promise<string> {
		const row = await this.prisma.chartImage.upsert({
			where: { toolCallId },
			create: { toolCallId, data },
			update: { data },
			select: { id: true },
		});
		return row.id;
	}

	/** Returns the clinic owner and parent chat of the chat that contains the given chart tool call. */
	async getChartOwnerInfo(toolCallId: string): Promise<{ clinicId: string; userId: string; chatId: string } | null> {
		const part = await this.prisma.messagePart.findFirst({
			where: displayChartToolCall(toolCallId),
			select: { chatMessage: { select: { chat: { select: { id: true, clinicId: true, userId: true } } } } },
		});
		const chat = part?.chatMessage.chat;
		return chat ? { clinicId: chat.clinicId, userId: chat.userId, chatId: chat.id } : null;
	}

	async updateChartConfig(toolCallId: string, config: displayChart.Input): Promise<void> {
		await this.prisma.$transaction([
			this.prisma.messagePart.updateMany({
				where: displayChartToolCall(toolCallId),
				data: { toolInput: config as Prisma.InputJsonValue },
			}),
			// Invalidate any cached PNG so externally-served chart images refresh.
			this.prisma.chartImage.deleteMany({ where: { toolCallId } }),
		]);
	}

	async getDisplayChartTableFormatsForChat(
		chatId: string,
	): Promise<Record<string, displayChart.ColumnConditionalFormats>> {
		const rows = await this.prisma.messagePart.findMany({
			where: { type: DISPLAY_CHART_TOOL_TYPE, chatMessage: { chatId, supersededAt: null } },
			orderBy: [{ chatMessage: { createdAt: 'asc' } }, { order: 'asc' }],
			select: { toolInput: true },
		});
		return selectLatestDisplayChartTableFormats(rows);
	}

	/** Owner of the chat holding a `display_map` tool call (upstream `getMapOwnerId`). */
	async getMapOwnerId(toolCallId: string): Promise<string | undefined> {
		const part = await this.prisma.messagePart.findFirst({
			where: { toolCallId, type: DISPLAY_MAP_TOOL_TYPE },
			select: { chatMessage: { select: { chat: { select: { userId: true } } } } },
		});
		return part?.chatMessage.chat.userId;
	}

	async updateMapConfig(toolCallId: string, config: displayMap.Input): Promise<void> {
		await this.prisma.messagePart.updateMany({
			where: { toolCallId, type: DISPLAY_MAP_TOOL_TYPE },
			data: { toolInput: config as Prisma.InputJsonValue },
		});
	}

	/** Chats (not deleted) with a message part that shows the image (upstream `listChatsReferencingImage`). */
	async listChatsReferencingImage(imageId: string): Promise<{ chatId: string; clinicId: string }[]> {
		const chats = await this.prisma.chat.findMany({
			where: { deletedAt: null, chatMessages: { some: { messageParts: { some: { imageId } } } } },
			select: { id: true, clinicId: true },
		});
		return chats.map((chat) => ({ chatId: chat.id, clinicId: chat.clinicId }));
	}

	async getImageById(id: string): Promise<{ data: string; mediaType: string } | null> {
		return this.prisma.messageImage.findUnique({ where: { id }, select: { data: true, mediaType: true } });
	}
}

function displayChartToolCall(toolCallId: string): Prisma.MessagePartWhereInput {
	return { toolCallId, type: DISPLAY_CHART_TOOL_TYPE };
}
