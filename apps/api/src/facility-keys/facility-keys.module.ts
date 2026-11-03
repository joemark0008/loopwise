import { Module } from '@nestjs/common';

import { FacilityKeyGuard } from './facility-key.guard.js';
import { FacilityKeyRepository } from './facility-key.repository.js';
import { FacilityKeyService } from './facility-key.service.js';
import { FacilityKeysResolver } from './facility-keys.resolver.js';

/**
 * Facility keys: how facility systems (the edge connector, a LIS) authenticate to the REST ingest. Modules with a
 * `@FacilityKey()` controller import this one for the guard.
 */
@Module({
	providers: [FacilityKeysResolver, FacilityKeyService, FacilityKeyRepository, FacilityKeyGuard],
	exports: [FacilityKeyService, FacilityKeyGuard],
})
export class FacilityKeysModule {}
