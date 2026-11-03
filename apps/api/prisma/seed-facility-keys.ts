import { describeFacilityKey } from '../src/facility-keys/facility-key-token.js';
import type { Prisma } from '../src/generated/prisma/client.js';

/**
 * A fixed facility key for the Bohol Diagnostics lab, so the edge connector and `scripts/send-hl7-sample.sh` work on
 * a fresh database. DEV ONLY: the key is public (it is in this file and `.env.example`); never seed it in production.
 */
export const DEV_LAB_FACILITY_KEY = 'lw_dev_bohol_diagnostics_synthetic_key_0001';

/** Idempotent: creates the key once, for databases seeded before facility keys too. Returns the key, or null. */
export async function seedFacilityKeys(tx: Prisma.TransactionClient): Promise<string | null> {
	const lab = await tx.organization.findUnique({ where: { slug: 'bohol-diagnostics' } });
	const labTech = await tx.user.findUnique({ where: { email: 'lab.bautista@loopwise.test' } });
	if (!lab || !labTech) {
		return null;
	}
	const { keyHash, keyPrefix } = describeFacilityKey(DEV_LAB_FACILITY_KEY);
	await tx.apiKey.upsert({
		where: { keyHash },
		create: { orgId: lab.id, name: 'Dev edge connector (synthetic)', keyHash, keyPrefix, createdBy: labTech.id },
		update: {},
	});
	return DEV_LAB_FACILITY_KEY;
}
