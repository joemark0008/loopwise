import { PrismaPg } from '@prisma/adapter-pg';

import { loadDotenv, parseEnv } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seedBilling } from './seed-billing.js';
import { seedBillingDesk } from './seed-billing-desk.js';
import { DEMO_CLINIC_CODE, DEMO_ORG_SLUG } from './seed-clinical.js';

/**
 * Adds the cashier desk's demo (`seed-billing-desk.ts`) to a database seeded before it existed, without reseeding:
 * senior citizen IDs, doctors' fee terms, the cashier's open shift and a visit sent to the cashier; and the price list,
 * series and Maria's paid visit (`seed-billing.ts`) when the clinic has no price list yet. Each part is skipped when
 * present, so it can run again. `npm run db:seed:billing -w @loopwise/api`.
 */
async function run() {
	loadDotenv();
	const env = parseEnv();
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
	try {
		const done = await prisma.$transaction(
			async (tx) => {
				const organization = await tx.organization.findUniqueOrThrow({ where: { slug: DEMO_ORG_SLUG } });
				await tx.clinic.findFirstOrThrow({
					where: { organizationId: organization.id, code: DEMO_CLINIC_CODE },
				});
				const added: string[] = [];
				if (!(await tx.serviceItem.count({ where: { organizationId: organization.id } }))) {
					await seedBilling(tx);
					added.push('the price list, invoice series and Maria’s paid visit');
				}
				return [...added, ...(await seedBillingDesk(tx))];
			},
			{ timeout: 60_000 },
		);
		console.log(done.length > 0 ? `Billing demo added: ${done.join('; ')}.` : 'Billing demo already present.');
	} finally {
		await prisma.$disconnect();
	}
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
