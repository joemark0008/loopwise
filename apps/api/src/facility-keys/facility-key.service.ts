import { Injectable } from '@nestjs/common';

import { HandlerError } from '../common/errors/handler-error.js';
import type { Organization } from '../generated/prisma/client.js';
import { FacilityKeyRepository } from './facility-key.repository.js';
import { generateFacilityKey, hashFacilityKey } from './facility-key-token.js';
import type { CreatedFacilityKey, FacilityKey } from './models/facility-key.model.js';

/** `lastUsedAt` is written at most this often per key, so a busy connector does not update the row per message. */
const TOUCH_INTERVAL_MS = 60_000;

@Injectable()
export class FacilityKeyService {
	constructor(private readonly keys: FacilityKeyRepository) {}

	list(orgId: string): Promise<FacilityKey[]> {
		return this.keys.listForOrg(orgId);
	}

	/** Issues a key for the organization. The plain key is returned once; only its hash is stored. */
	async create(orgId: string, userId: string, name: string): Promise<CreatedFacilityKey> {
		const issued = generateFacilityKey();
		const facilityKey = await this.keys.create({
			orgId,
			name,
			keyHash: issued.keyHash,
			keyPrefix: issued.keyPrefix,
			createdBy: userId,
		});
		return { key: issued.key, facilityKey };
	}

	async revoke(orgId: string, id: string): Promise<boolean> {
		if ((await this.keys.deleteForOrg(orgId, id)) === 0) {
			throw new HandlerError('NOT_FOUND', 'Facility key not found');
		}
		return true;
	}

	/** The organization a presented key belongs to, or null for an unknown or revoked key. Records the use. */
	async authenticate(key: string): Promise<Organization | null> {
		const found = await this.keys.findByHash(hashFacilityKey(key));
		if (!found) {
			return null;
		}
		const now = new Date();
		if (!found.lastUsedAt || now.getTime() - found.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
			await this.keys.touch(found.id, now);
		}
		return found.organization;
	}
}
