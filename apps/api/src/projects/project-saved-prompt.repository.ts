import { Injectable } from '@nestjs/common';

import type { Prisma, ProjectSavedPrompt } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Port of upstream `queries/project-saved-prompt.queries.ts`. */
@Injectable()
export class ProjectSavedPromptRepository {
	constructor(private readonly prisma: PrismaService) {}

	listSavedPrompts(projectId: string): Promise<ProjectSavedPrompt[]> {
		return this.prisma.projectSavedPrompt.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
	}

	createSavedPrompt(data: Prisma.ProjectSavedPromptUncheckedCreateInput): Promise<ProjectSavedPrompt> {
		return this.prisma.projectSavedPrompt.create({ data });
	}

	async updateSavedPrompt(
		projectId: string,
		promptId: string,
		data: { title?: string; prompt?: string },
	): Promise<ProjectSavedPrompt | null> {
		const { count } = await this.prisma.projectSavedPrompt.updateMany({ where: { id: promptId, projectId }, data });
		return count > 0 ? this.prisma.projectSavedPrompt.findUnique({ where: { id: promptId } }) : null;
	}

	async deleteSavedPrompt(projectId: string, promptId: string): Promise<void> {
		await this.prisma.projectSavedPrompt.deleteMany({ where: { id: promptId, projectId } });
	}
}
