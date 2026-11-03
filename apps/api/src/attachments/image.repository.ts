import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

/** An image attached to a message (upstream `ChatImage`). */
export interface ChatImage {
	id: string;
	data: string;
	mediaType: string;
}

/** Port of upstream `queries/image.queries.ts`: images attached to chat messages (`message_image`). */
@Injectable()
export class ImageRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** The images of a chat's current messages (superseded edits left out). */
	async getImagesByChatId(chatId: string): Promise<ChatImage[]> {
		const parts = await this.prisma.messagePart.findMany({
			where: { imageId: { not: null }, chatMessage: { chatId, supersededAt: null } },
			select: { messageImage: { select: { id: true, data: true, mediaType: true } } },
		});
		return parts.flatMap(({ messageImage }) => (messageImage ? [messageImage] : []));
	}

	async saveImage(image: { mediaType: string; data: string }): Promise<{ id: string }> {
		return this.prisma.messageImage.create({ data: image, select: { id: true } });
	}

	async saveImages(images: { mediaType: string; data: string }[]): Promise<{ id: string; mediaType: string }[]> {
		if (images.length === 0) {
			return [];
		}
		return this.prisma.messageImage.createManyAndReturn({
			data: images,
			select: { id: true, mediaType: true },
		});
	}

	/** Chats (not deleted) whose messages reference the image. */
	async listChatsReferencingImage(imageId: string): Promise<Array<{ chatId: string; projectId: string }>> {
		const chats = await this.prisma.chat.findMany({
			where: { deletedAt: null, chatMessages: { some: { messageParts: { some: { imageId } } } } },
			select: { id: true, projectId: true },
		});
		return chats.map((chat) => ({ chatId: chat.id, projectId: chat.projectId }));
	}

	async getImageById(id: string): Promise<{ data: string; mediaType: string } | undefined> {
		const image = await this.prisma.messageImage.findUnique({
			where: { id },
			select: { data: true, mediaType: true },
		});
		return image ?? undefined;
	}
}
