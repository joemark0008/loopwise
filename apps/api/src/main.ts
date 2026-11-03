import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { ConfigService } from './config/config.service.js';
import { serveFrontend } from './frontend-static.js';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
	configureApp(app);

	const config = app.get(ConfigService);
	if (config.env.QUARRY_FRONTEND_DIST) {
		serveFrontend(app, config.env.QUARRY_FRONTEND_DIST);
	}
	await app.listen(config.env.PORT);
	Logger.log(`quarry api listening on http://localhost:${config.env.PORT}`, 'Bootstrap');
}

void bootstrap();
