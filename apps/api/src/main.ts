import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { RequestContextLogger } from './common/request-context-logger.js';
import { ConfigService } from './config/config.service.js';
import { serveFrontend } from './frontend-static.js';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bodyParser: false,
		logger: new RequestContextLogger(),
	});
	configureApp(app);

	const config = app.get(ConfigService);
	if (config.env.LOOPWISE_FRONTEND_DIST) {
		serveFrontend(app, config.env.LOOPWISE_FRONTEND_DIST);
	}
	await app.listen(config.env.PORT);
	Logger.log(`loopwise api listening on http://localhost:${config.env.PORT}`, 'Bootstrap');
}

void bootstrap();
