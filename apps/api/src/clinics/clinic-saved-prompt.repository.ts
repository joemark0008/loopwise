import { Injectable } from '@nestjs/common';

import type { ClinicSavedPrompt, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Port of upstream `queries/clinic-saved-prompt.queries.ts`. */
@Injectable()
export class ClinicSavedPromptRepository {
	constructor(private readonly prisma: PrismaService) {}

	listSavedPrompts(clinicId: string): Promise<ClinicSavedPrompt[]> {
		return this.prisma.clinicSavedPrompt.findMany({ where: { clinicId }, orderBy: { createdAt: 'desc' } });
	}

	createSavedPrompt(data: Prisma.ClinicSavedPromptUncheckedCreateInput): Promise<ClinicSavedPrompt> {
		return this.prisma.clinicSavedPrompt.create({ data });
	}

	async updateSavedPrompt(
		clinicId: string,
		promptId: string,
		data: { title?: string; prompt?: string },
	): Promise<ClinicSavedPrompt | null> {
		const { count } = await this.prisma.clinicSavedPrompt.updateMany({ where: { id: promptId, clinicId }, data });
		return count > 0 ? this.prisma.clinicSavedPrompt.findUnique({ where: { id: promptId } }) : null;
	}

	async deleteSavedPrompt(clinicId: string, promptId: string): Promise<void> {
		await this.prisma.clinicSavedPrompt.deleteMany({ where: { id: promptId, clinicId } });
	}
}
