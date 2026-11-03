import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { HubClient } from '../src/hub-client.ts';
import { syntheticOru } from './helpers.ts';

/** An HbA1c for Maria Santos, the seeded synthetic patient (as apps/api/src/hl7/oru-samples.ts), so the hub matches her. */
const seededOru = (controlId: string) =>
	[
		`MSH|^~\\&|BDL-LIS|BOHOL-DIAGNOSTICS|LOOPWISE|TAGBILARAN-HC|20261103080000+0800||ORU^R01^ORU_R01|${controlId}|P|2.5.1`,
		'PID|1||THC-0001^^^THC^MR~SYN-0000-0001^^^PhilHealth^NH||Santos^Maria||19810412|F',
		'OBR|1||BDL-ACC-IT|4548-4^Hemoglobin A1c^LN|||20261103070000+0800',
		'OBX|1|NM|4548-4^Hemoglobin A1c/Hemoglobin.total in Blood^LN||7.2|%|4.0-5.6|H|||F',
	].join('\r');
const newControlId = () => `IT${randomUUID().replace(/-/g, '').slice(0, 18)}`;

/**
 * Against a real hub (`npm run dev:api` with the seed). Skipped unless HUB_IT_URL is set:
 *
 *   HUB_IT_URL=http://localhost:5006 HUB_IT_KEY=lw_dev_bohol_diagnostics_synthetic_key_0001 \
 *     npm test -w @loopwise/connector -- hub.integration
 *
 * HUB_IT_OUTBOX=1 also checks the outbox endpoint. Synthetic messages only; each run adds one HbA1c result for the
 * seeded synthetic patient to that hub's database.
 */
const hubUrl = process.env.HUB_IT_URL;
const facilityKey = process.env.HUB_IT_KEY ?? 'lw_dev_bohol_diagnostics_synthetic_key_0001';

describe.skipIf(!hubUrl)('hub integration', () => {
	const client = (key = facilityKey) => new HubClient({ hubUrl: hubUrl!, facilityKey: key, timeoutMs: 10_000 });

	it('acknowledges an ORU, and the same MSH-10 again (idempotent)', async () => {
		const message = seededOru(newControlId());
		const first = await client().postMessage(message);
		expect(first).toMatchObject({ kind: 'ack', code: 'AA' });
		const again = await client().postMessage(message);
		expect(again).toMatchObject({ kind: 'ack', code: 'AA' });
	});

	it('answers AE for a patient it cannot match (the connector marks it failed)', async () => {
		expect(await client().postMessage(syntheticOru(newControlId()))).toMatchObject({ kind: 'ack', code: 'AE' });
	});

	it('answers a wrong key with 401', async () => {
		expect(await client('lw_not_a_real_key').postMessage(syntheticOru('ITBADKEY'))).toMatchObject({
			kind: 'unauthorized',
			status: 401,
		});
	});

	it.skipIf(!process.env.HUB_IT_OUTBOX)('lists the outbox', async () => {
		expect(await client().fetchOutbox(5)).toMatchObject({ kind: 'ok' });
	});
});
