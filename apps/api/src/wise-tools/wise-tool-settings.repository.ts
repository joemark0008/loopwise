import { Injectable } from '@nestjs/common';

import type { WiseToolSetting } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type WiseToolOwner = { orgId: string } | { userId: string };

/**
 * Wise tool settings (`wise_tool_setting`): a facility's overrides and a user's own opt-outs. Not clinical data, so it
 * is on the bare Prisma client; the service decides who may read or change which rows. Each change writes an
 * `audit_log` row (no patient) in the same transaction.
 */
@Injectable()
export class WiseToolSettingsRepository {
	constructor(private readonly prisma: PrismaService) {}

	listFor(orgIds: readonly string[], userId: string): Promise<WiseToolSetting[]> {
		return this.prisma.wiseToolSetting.findMany({
			where: { OR: [{ orgId: { in: [...orgIds] } }, { userId }] },
		});
	}

	async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
		const member = await this.prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } });
		return member?.role === 'admin';
	}

	/** Sets an override, or removes it (`enabled` null: back to the default), and audits the change. */
	async set(owner: WiseToolOwner, toolName: string, enabled: boolean | null, updatedById: string): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.wiseToolSetting.deleteMany({ where: { ...owner, toolName } });
			if (enabled !== null) {
				await tx.wiseToolSetting.create({ data: { ...owner, toolName, enabled, updatedById } });
			}
			await tx.auditLog.create({
				data: {
					userId: updatedById,
					orgId: 'orgId' in owner ? owner.orgId : null,
					patientId: null,
					action: enabled === null ? 'wise_tool.reset' : enabled ? 'wise_tool.enable' : 'wise_tool.disable',
					resource: 'wise_tool',
					resourceId: toolName,
					reason: 'orgId' in owner ? 'facility setting' : 'own setting',
				},
			});
		});
	}
}
