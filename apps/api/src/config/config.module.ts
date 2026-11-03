import { Global, Module } from '@nestjs/common';

import { ConfigService } from './config.service.js';
import { loadDotenv, parseEnv } from './env.js';

@Global()
@Module({
	providers: [
		{
			provide: ConfigService,
			useFactory: () => {
				loadDotenv();
				return new ConfigService(parseEnv());
			},
		},
	],
	exports: [ConfigService],
})
export class ConfigModule {}
