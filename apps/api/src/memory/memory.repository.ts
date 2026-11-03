import { Injectable } from '@nestjs/common';

import type { MemoryCategory, MemoryRecord, NewMemoryRecord } from '../agent/types/memory.js';
import type { Memory } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Port of upstream `queries/memory.ts`. */
@Injectable()
export class MemoryRepository {
	constructor(private readonly prisma: PrismaService) {}

	async getUserMemories(userId: string, excludeChatId?: string): Promise<MemoryRecord[]> {
		const memories = await this.prisma.memory.findMany({
			where: {
				userId,
				supersededBy: null,
				...(excludeChatId && { OR: [{ chatId: { not: excludeChatId } }, { chatId: null }] }),
			},
			orderBy: { createdAt: 'desc' },
		});
		return memories.map(toMemoryRecord);
	}

	async getIsMemoryEnabledForUserAndProject(userId: string, projectId: string): Promise<boolean> {
		const [user, project] = await Promise.all([
			this.prisma.user.findUnique({ where: { id: userId }, select: { memoryEnabled: true } }),
			this.prisma.project.findUnique({ where: { id: projectId }, select: { agentSettings: true } }),
		]);
		if (!user || !project) {
			return false;
		}
		const agentSettings = project.agentSettings as { memoryEnabled?: boolean } | null;
		return user.memoryEnabled && (agentSettings?.memoryEnabled ?? true);
	}

	async getUserMemoryEnabled(userId: string): Promise<boolean> {
		const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { memoryEnabled: true } });
		return user?.memoryEnabled ?? true;
	}

	/** Upstream `projectQueries.getProjectMemoryEnabled`: the admin's `agentSettings.memoryEnabled`, on by default. */
	async getProjectMemoryEnabled(projectId: string): Promise<boolean> {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
			select: { agentSettings: true },
		});
		return (project?.agentSettings as { memoryEnabled?: boolean } | null)?.memoryEnabled ?? true;
	}

	async setUserMemoryEnabled(userId: string, memoryEnabled: boolean): Promise<void> {
		await this.prisma.user.update({ where: { id: userId }, data: { memoryEnabled } });
	}

	/** Inserts the new memories and points each superseded memory at its replacement, in one transaction. */
	async upsertAndSupersedeMemories(memories: NewMemoryRecord[]): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			for (const { supersedesId, ...memory } of memories) {
				const { id } = await tx.memory.create({ data: memory, select: { id: true } });
				if (supersedesId) {
					await tx.memory.update({ where: { id: supersedesId }, data: { supersededBy: id } });
				}
			}
		});
	}

	async updateUserMemoryContent(userId: string, memoryId: string, content: string): Promise<MemoryRecord | null> {
		const { count } = await this.prisma.memory.updateMany({ where: { id: memoryId, userId }, data: { content } });
		if (count === 0) {
			return null;
		}
		const memory = await this.prisma.memory.findUnique({ where: { id: memoryId } });
		return memory ? toMemoryRecord(memory) : null;
	}

	async deleteUserMemory(userId: string, memoryId: string): Promise<MemoryRecord | null> {
		const memory = await this.prisma.memory.findFirst({ where: { id: memoryId, userId } });
		if (!memory) {
			return null;
		}
		await this.prisma.memory.delete({ where: { id: memoryId } });
		return toMemoryRecord(memory);
	}
}

function toMemoryRecord(memory: Memory): MemoryRecord {
	return { ...memory, category: memory.category as MemoryCategory };
}
