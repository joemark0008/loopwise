import { Module } from '@nestjs/common';

import { OrdersModule } from '../clinical/orders/orders.module.js';
import { ResultsModule } from '../clinical/results/results.module.js';
import { ClinicalDbModule } from '../clinical/rls/clinical-db.module.js';
import { FacilityKeysModule } from '../facility-keys/facility-keys.module.js';
import { Hl7IngestController } from './hl7-ingest.controller.js';
import { Hl7IngestService } from './hl7-ingest.service.js';
import { Hl7MessageRepository } from './hl7-message.repository.js';

/** HL7 v2 in: the facility-key REST endpoint the edge connector posts ORU messages to. */
@Module({
	imports: [FacilityKeysModule, ClinicalDbModule, ResultsModule, OrdersModule],
	controllers: [Hl7IngestController],
	providers: [Hl7IngestService, Hl7MessageRepository],
})
export class Hl7Module {}
