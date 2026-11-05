import { Controller, Get, Header, Param, Query } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.service.js';
import { CurrentUser } from '../common/decorators/current.decorator.js';
import { MapBoundariesService } from './map-boundaries.service.js';

/** Port of upstream `routes/map-boundaries.ts` (`/api/map-boundaries`): boundary GeoJSON for the map views. */
@Controller('api/map-boundaries')
export class MapBoundariesController {
	constructor(private readonly boundaries: MapBoundariesService) {}

	/** Declared first so `proxy` isn't read as a clinic id. */
	@Get('proxy')
	@Header('Cache-Control', 'private, max-age=86400')
	proxy(@Query('url') url: unknown) {
		return this.boundaries.proxyBoundary(url);
	}

	@Get(':clinicId/:key')
	@Header('Cache-Control', 'private, max-age=600')
	getBoundary(@CurrentUser() user: AuthUser, @Param('clinicId') clinicId: string, @Param('key') key: string) {
		return this.boundaries.getClinicBoundary(clinicId, key, user.id);
	}
}
