import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessRepository } from './access.repository.js';
import { AccessService } from './access.service.js';
import { AuthGuard } from './auth.guard.js';

@Module({
	providers: [AccessRepository, AccessService, { provide: APP_GUARD, useClass: AuthGuard }],
	exports: [AccessService],
})
export class GuardsModule {}
