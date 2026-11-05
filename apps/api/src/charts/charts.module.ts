import { Module } from '@nestjs/common';

import { ChatsCoreModule } from '../chats/chats-core.module.js';
import { ClinicsCoreModule } from '../clinical/clinics/clinics/clinics-core.module.js';
import { ChartRepository } from './chart.repository.js';
import { ChartImagesController, MessageImagesController } from './charts.controller.js';
import { ChartsResolver } from './charts.resolver.js';
import { ChartsService } from './charts.service.js';
import { MapBoundariesController } from './map-boundaries.controller.js';
import { MapBoundariesResolver } from './map-boundaries.resolver.js';
import { MapBoundariesService } from './map-boundaries.service.js';

/**
 * Charts and maps (Phase 2d): chart PNGs (`/c`), message images (`/i`), boundary GeoJSON (`/api/map-boundaries`),
 * chart download and config edits, chart plugins and the clinic's custom boundary sets over GraphQL.
 */
@Module({
	imports: [ChatsCoreModule, ClinicsCoreModule],
	controllers: [ChartImagesController, MessageImagesController, MapBoundariesController],
	providers: [ChartRepository, ChartsService, ChartsResolver, MapBoundariesService, MapBoundariesResolver],
})
export class ChartsModule {}
