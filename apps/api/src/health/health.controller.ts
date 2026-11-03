import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../common/decorators/public.decorator.js';
import { HealthService, type HealthStatus } from './health.service.js';

@Controller('health')
export class HealthController {
	constructor(private readonly health: HealthService) {}

	@Public()
	@Get()
	async get(@Res({ passthrough: true }) res: Response): Promise<HealthStatus> {
		const result = await this.health.check();
		res.status(result.status === 'ok' ? 200 : 503);
		return result;
	}
}
