import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { ConfigService } from '../config/config.service.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** The app database. Only repositories may inject it. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
	constructor(config: ConfigService) {
		super({
			adapter: new PrismaPg({
				connectionString: config.env.DATABASE_URL,
				ssl: config.env.DB_SSL ? { rejectUnauthorized: false } : undefined,
			}),
			log: config.env.DB_QUERY_LOGGING ? ['query', 'warn', 'error'] : ['warn', 'error'],
		});
	}

	async onModuleInit(): Promise<void> {
		await this.$connect();
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}
