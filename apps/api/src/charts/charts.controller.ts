import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../common/decorators/current.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ChartsService } from './charts.service.js';

/** Port of upstream `routes/chart.ts` (`/c`): rendered chart PNGs, public like upstream (links in messages). */
@Controller('c')
export class ChartImagesController {
	constructor(private readonly charts: ChartsService) {}

	@Public()
	@Get(':chatId/:chartId.png')
	async getChart(@Param('chartId') chartId: string, @Res() response: Response): Promise<void> {
		const buffer = await this.charts.getChartPng(chartId);
		response.setHeader('Content-Type', 'image/png').send(buffer);
	}
}

/** Port of upstream `routes/image.ts` (`/i`): images attached to chat messages. */
@Controller('i')
export class MessageImagesController {
	constructor(private readonly charts: ChartsService) {}

	@Get(':imageId')
	async getImage(
		@CurrentUser() user: AuthUser,
		@Param('imageId') imageId: string,
		@Res() response: Response,
	): Promise<void> {
		const image = await this.charts.getImageForUser(imageId, user.id);
		response
			.setHeader('Content-Type', image.mediaType)
			.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
			.send(image.buffer);
	}
}
