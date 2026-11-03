import { Injectable } from '@nestjs/common';

import type { ApiKey, Organization } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type FacilityKeyWithOrg = ApiKey & { organization: Organization };

/**
 * Facility keys are `api_key` rows: an organization's machine credential for the HL7 / edge-connector ingest. Not
 * clinical data, so they live on the bare Prisma client (the table has no row-level security).
 */
@Injectable()
export class FacilityKeyRepository {
	constructor(private readonly prisma: PrismaService) {}

	create(data: {
		orgId: string;
		name: string;
		keyHash: string;
		keyPrefix: string;
		createdBy: string;
	}): Promise<ApiKey> {
		return this.prisma.apiKey.create({ data });
	}

	listForOrg(orgId: string): Promise<ApiKey[]> {
		return this.prisma.apiKey.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } });
	}

	/** Deletes the key if it belongs to the organization; the number of rows removed (0 or 1). */
	async deleteForOrg(orgId: string, id: string): Promise<number> {
		const { count } = await this.prisma.apiKey.deleteMany({ where: { id, orgId } });
		return count;
	}

	findByHash(keyHash: string): Promise<FacilityKeyWithOrg | null> {
		return this.prisma.apiKey.findUnique({ where: { keyHash }, include: { organization: true } });
	}

	async touch(id: string, at: Date): Promise<void> {
		await this.prisma.apiKey.updateMany({ where: { id }, data: { lastUsedAt: at } });
	}
}
