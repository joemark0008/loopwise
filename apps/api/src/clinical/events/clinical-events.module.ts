import { Global, Module } from '@nestjs/common';

import { ClinicalEventsService } from './clinical-events.service.js';

/** Global: any clinical module may publish or subscribe without importing this one. */
@Global()
@Module({
	providers: [ClinicalEventsService],
	exports: [ClinicalEventsService],
})
export class ClinicalEventsModule {}
