import path from 'node:path';

import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// The .env file lives at the repository root, shared by every app.
dotenv.config({ path: path.join(import.meta.dirname, '..', '..', '.env'), quiet: true });

export default defineConfig({
	schema: 'prisma/schema',
	migrations: {
		path: 'prisma/migrations',
		seed: 'node --import @swc-node/register/esm-register prisma/seed.ts',
	},
	datasource: {
		url: env('DATABASE_URL'),
	},
});
