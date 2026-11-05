import { Injectable } from '@nestjs/common';

import type { ClinicalTx } from '../clinical/rls/clinical-db.service.js';
import type { WiseToolSetting } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type WiseToolOwner = { organizationId: string } | { userId: string };

/**
 * Wise tool settings (`wise_tool_settings`): an organization's overrides and a user's own opt-outs. Not clinical data,
 * so reads are on the bare Prisma client; the service decides who may read or change which rows, and writes on the
 * transaction it audits in.
 */
@Injectable()
export class WiseToolSettingsRepository {
	constructor(private readonly prisma: PrismaService) {}

	listFor(organizationIds: readonly string[], userId: string): Promise<WiseToolSetting[]> {
		return this.prisma.wiseToolSetting.findMany({
			where: { OR: [{ organizationId: { in: [...organizationIds] } }, { userId }] },
		});
	}

	/** Sets an override, or removes it (`enabled` null: back to the default). */
	async set(
		tx: ClinicalTx,
		owner: WiseToolOwner,
		toolName: string,
		enabled: boolean | null,
		updatedById: string,
	): Promise<void> {
		await tx.wiseToolSetting.deleteMany({ where: { ...owner, toolName } });
		if (enabled !== null) {
			await tx.wiseToolSetting.create({ data: { ...owner, toolName, enabled, updatedById } });
		}
	}
}
